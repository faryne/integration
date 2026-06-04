package main

import (
	"errors"
	"flag"
	"os"
	"os/signal"
	"reflect"
	"syscall"
	"time"

	"faryne.dev/config"
	"faryne.dev/controller/opendata"
	"faryne.dev/model/enum"
	"faryne.dev/route"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"faryne.dev/service/output"
	"faryne.dev/service/twse"
	"faryne.dev/service/validation"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	recover2 "github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
)

var envFile = "./.env"
var inputEnvFile = ""
var reload bool
var buildVersion = "development"

type appRuntime struct {
	app       *fiber.App
	cron      *cron.Cron
	listenErr chan error
}

func newApp() *fiber.App {
	app := fiber.New(fiber.Config{
		ServerHeader:    "faryne.dev",
		AppName:         "faryne.dev",
		StrictRouting:   true,
		CaseSensitive:   true,
		UnescapePath:    true,
		BodyLimit:       1024 * 1024 * 1024,
		StructValidator: validation.NewStructValidator(),
		ErrorHandler: func(ctx fiber.Ctx, err error) error {
			if reflect.ValueOf(err).MethodByName("HttpCode").IsValid() {
				var v output.CommonOutputInterface
				errors.As(err, &v)
				var costTime = float64(-1)
				var endTime = float64(time.Now().UnixMilli())
				if startTime := ctx.Locals("start_time"); startTime != nil {
					costTime = (endTime - float64(startTime.(int64))) / float64(time.Microsecond)
				}
				uri := ctx.Scheme() + "://" + ctx.Hostname() + ctx.Path()
				if ctx.Request().URI().QueryArgs().Len() > 0 {
					uri = uri + "?" + ctx.Request().URI().QueryArgs().String()
				}
				finalOutput := v.Output(costTime, uri)
				finalOutput.Method = ctx.Method()
				return ctx.Status(finalOutput.Code).JSON(finalOutput)
			}
			return ctx.JSON(err.Error())
		},
	})
	return app
}

// @title faryne.dev API
// @version 1.0
// @description faryne.dev backend API documentation.
// @BasePath /
func main() {
	// 處理 env
	flag.StringVar(&inputEnvFile, "env", "", "path of env file")
	flag.BoolVar(&reload, "reload", false, "reload app")
	flag.Parse()

	runtime, err := loadAllSettings(inputEnvFile)
	if err != nil {
		log.Logger().Panic("Start app failed: " + err.Error())
	}
	logBuildEvent("start")

	if reload {
		logBuildEvent("restart")
		if err := gracefulRestart(runtime); err != nil {
			log.Logger().Panic("Graceful restart failed: " + err.Error())
		}
		return
	}

	waitForSignal(runtime)
}

func waitForSignal(runtime *appRuntime) {
	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP)
	defer signal.Stop(signalChan)

	for {
		select {
		case err := <-runtime.listenErr:
			if err != nil {
				log.Logger().Panic("Listen and serve error: " + err.Error())
			}
			return
		case sig := <-signalChan:
			switch sig {
			case syscall.SIGHUP:
				logBuildEvent("restart")
				if err := gracefulRestart(runtime); err != nil {
					log.Logger().Panic("Graceful restart failed: " + err.Error())
				}
				return
			default:
				logBuildEvent("shutdown")
				if err := shutdownAllSettings(runtime); err != nil {
					log.Logger().Panic("Graceful shutdown failed: " + err.Error())
				}
				return
			}
		}
	}
}

func logBuildEvent(event string) {
	log.Logger().Info("App " + event + ": buildVersion=" + buildVersion)
}

func shutdownAllSettings(runtime *appRuntime) error {
	if runtime == nil {
		return nil
	}
	var shutdownErr error
	if runtime.app != nil {
		shutdownErr = errors.Join(shutdownErr, runtime.app.ShutdownWithTimeout(30*time.Second))
	}
	if runtime.cron != nil {
		ctx := runtime.cron.Stop()
		select {
		case <-ctx.Done():
		case <-time.After(30 * time.Second):
			shutdownErr = errors.Join(shutdownErr, errors.New("cron shutdown timeout"))
		}
	}
	shutdownErr = errors.Join(shutdownErr, client.CloseRedisConnections())
	shutdownErr = errors.Join(shutdownErr, client.CloseMySqlConnections())
	return shutdownErr
}

func gracefulRestart(runtime *appRuntime) error {
	if err := shutdownAllSettings(runtime); err != nil {
		return err
	}
	path, err := os.Executable()
	if err != nil {
		return err
	}
	return syscall.Exec(path, os.Args, os.Environ())
}

func loadAllSettings(inputEnvFile string) (*appRuntime, error) {
	if inputEnvFile != "" {
		envFile = inputEnvFile
	}
	if _, err := os.Stat(envFile); err == nil {
		if envError := godotenv.Load(envFile); envError != nil {
			return nil, envError
		}
	} else {
		return nil, err
	}
	config.InitEnvConfig()

	// 啟動 DB 連線
	dbConnections := map[enum.DBName]string{
		enum.DBWalolita: config.EnvConfig().WalolitaDSN,
		enum.DBNekomaid: config.EnvConfig().NekomaidDSN,
	}
	for key, conn := range dbConnections {
		connError := client.InitMySql(key, conn)
		if connError != nil {
			_ = client.CloseMySqlConnections()
			return nil, connError
		}
	}

	if config.EnvConfig().RedisDSN != "" {
		redisConnError := client.InitRedis(enum.RedisDefault, config.EnvConfig().RedisDSN)
		if redisConnError != nil {
			_ = client.CloseRedisConnections()
			_ = client.CloseMySqlConnections()
			return nil, redisConnError
		}
	}

	esConnError := client.InitElasticSearch(enum.ESDefault, []string{config.EnvConfig().ESDSN})
	if esConnError != nil {
		_ = client.CloseRedisConnections()
		_ = client.CloseMySqlConnections()
		return nil, esConnError
	}

	app := newApp()

	// 記錄開始時間
	app.Use(func(c fiber.Ctx) error {
		c.Locals("start_time", time.Now().UnixMilli())
		return c.Next()
	})
	app.Use(recover2.New())
	app.Use(logger.New())
	app.Use(cors.New())
	// <editor-fold desc="">
	route.Nekomaid(app) // nekomaid
	route.OpenData(app)
	route.Tools(app)
	route.SNS(app)
	app.Get("/dmm/avsearch", opendata.DMMDailyVideo)
	route.Swagger(app)
	// </editor-fold>

	// <editor-fold desc="cronjob">
	c := cron.New(cron.WithParser(cron.NewParser(
		cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
	)))

	c.AddFunc("0 0 * * 1", func() {
		_, _ = twse.UpdateETFCodeList()
		twse.UpdateETFShare(enum.StockMarketTWSE)
	})
	c.AddFunc("0 0 * * 2", func() {
		twse.UpdateETFShare(enum.StockMarketOTC)
	})
	c.AddFunc("0 15 * * *", func() {
		d := time.Now().Format(time.DateOnly)
		twse.UpdateETFTicker("twse", d)
		twse.UpdateETFTicker("otc", d)
	})
	c.AddFunc("7 16 * * 1-5", func() {
		// 更新填息資訊
		// -- 更新除權息價格及計算殖利率
		twse.UpdateExPriceAndYieldRate()
		// -- 更新填息日等資訊
		twse.UpdateFilledDays()
		// -- 更新勝率填息平均日等
		twse.UpdateETFWinRate()
	})
	c.AddFunc("0 1 1 * *", func() {
		// 每月 1 號 凌晨 1 點執行前一個月的月均價統計
		now := time.Now()
		lastMonth := now.AddDate(0, -1, 0)
		s := twse.NewETFMonthlyPriceService()
		_ = s.UpdateMonthlyPriceByMonth(lastMonth.Year(), int(lastMonth.Month()))
	})
	c.AddFunc("0 8 * * *", func() {
		_ = twse.NotifyUpcomingETFEx()
	})

	c.Start()
	// </editor-fold>

	listenErr := make(chan error, 1)
	go func() {
		listenErr <- app.Listen(":" + config.EnvConfig().AppPort)
	}()

	return &appRuntime{
		app:       app,
		cron:      c,
		listenErr: listenErr,
	}, nil
}
