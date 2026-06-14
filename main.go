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
	avService "faryne.dev/service/av"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"faryne.dev/service/output"
	"faryne.dev/service/taipower"
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
var cmdName = ""

type cronJobConfig struct {
	Name     string
	Schedule string
	Handler  func()
}

var cronJobs = []cronJobConfig{
	{
		Name:     "etf-code-share-twse",
		Schedule: "0 0 * * 1",
		Handler: func() {
			_, _ = twse.UpdateETFCodeList()
			twse.UpdateETFShare(enum.StockMarketTWSE)
		},
	},
	{
		Name:     "etf-share-otc",
		Schedule: "0 0 * * 2",
		Handler: func() {
			twse.UpdateETFShare(enum.StockMarketOTC)
		},
	},
	{
		Name:     "etf-ticker-daily",
		Schedule: "0 15 * * *",
		Handler: func() {
			d := time.Now().Format(time.DateOnly)
			twse.UpdateETFTicker("twse", d)
			twse.UpdateETFTicker("otc", d)
		},
	},
	{
		Name:     "etf-ex-info",
		Schedule: "7 16 * * 1-5",
		Handler: func() {
			twse.UpdateExPriceAndYieldRate()
			twse.UpdateFilledDays()
			twse.UpdateETFWinRate()
		},
	},
	{
		Name:     "etf-monthly-price",
		Schedule: "0 1 1 * *",
		Handler: func() {
			now := time.Now()
			lastMonth := now.AddDate(0, -1, 0)
			s := twse.NewETFMonthlyPriceService()
			_ = s.UpdateMonthlyPriceByMonth(lastMonth.Year(), int(lastMonth.Month()))
		},
	},
	{
		Name:     "etf-notify-ex",
		Schedule: "0 8 * * *",
		Handler: func() {
			_ = twse.NotifyUpcomingETFEx()
		},
	},
	{
		Name:     "av-sync-xcity",
		Schedule: "37 1 * * 3",
		Handler: func() {
			avService.SyncXCityActressesCron()
		},
	},
	// 台電相關 job 手動執行
	{
		Name:     "taipower-neighbor-backfill",
		Schedule: "",
		Handler: func() {
			if err := taipower.NewNeighborService().Backfill(); err != nil {
				log.Logger().Error("Taipower neighbor backfill failed: " + err.Error())
			}
		},
	},
	{
		Name:     "taipower-neighbor-monthly",
		Schedule: "",
		Handler: func() {
			if _, err := taipower.NewNeighborService().CrawlPreviousMonth(); err != nil {
				log.Logger().Error("Taipower neighbor monthly crawl failed: " + err.Error())
			}
		},
	},
	{
		Name:     "taipower-neighbor-sync-es",
		Schedule: "",
		Handler: func() {
			if err := taipower.NewNeighborService().SyncAllToElasticsearch(); err != nil {
				log.Logger().Error("Taipower neighbor Elasticsearch sync failed: " + err.Error())
			}
		},
	},
}

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
	flag.StringVar(&cmdName, "cmd", "", "run specific command")
	flag.Parse()

	if cmdName != "" {
		if err := loadCommandSettings(inputEnvFile); err != nil {
			log.Logger().Panic("Initialize command failed: " + err.Error())
		}
		executeCommand(cmdName)
		if err := shutdownClients(); err != nil {
			log.Logger().Panic("Command shutdown failed: " + err.Error())
		}
		return
	}

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
	shutdownErr = errors.Join(shutdownErr, shutdownClients())
	return shutdownErr
}

func shutdownClients() error {
	var shutdownErr error
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
	if err := loadCommandSettings(inputEnvFile); err != nil {
		return nil, err
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
	route.Auth(app)
	route.SNS(app)
	route.MCP(app)
	app.Get("/dmm/avsearch", opendata.DMMDailyVideo)
	route.Swagger(app)
	// </editor-fold>

	// <editor-fold desc="cronjob">
	c := cron.New(cron.WithParser(cron.NewParser(
		cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
	)))

	for _, job := range cronJobs {
		if job.Schedule == "" {
			continue
		}
		jobName := job.Name
		c.AddFunc(job.Schedule, func() {
			runCronJob(jobName)
		})
	}

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

func loadCommandSettings(inputEnvFile string) error {
	if err := loadEnvSettings(inputEnvFile); err != nil {
		return err
	}

	// 啟動 DB 連線
	dbConnections := map[enum.DBName]string{
		enum.DBWalolita: config.EnvConfig().WalolitaDSN,
		enum.DBNekomaid: config.EnvConfig().NekomaidDSN,
	}
	for key, conn := range dbConnections {
		connError := client.InitMySql(key, conn)
		if connError != nil {
			_ = client.CloseMySqlConnections()
			return connError
		}
	}

	if config.EnvConfig().RedisDSN != "" {
		redisConnError := client.InitRedis(enum.RedisDefault, config.EnvConfig().RedisDSN)
		if redisConnError != nil {
			_ = client.CloseRedisConnections()
			_ = client.CloseMySqlConnections()
			return redisConnError
		}
	}

	esConnError := client.InitElasticSearch(enum.ESDefault, []string{config.EnvConfig().ESDSN})
	if esConnError != nil {
		_ = client.CloseRedisConnections()
		_ = client.CloseMySqlConnections()
		return esConnError
	}

	return nil
}

func loadEnvSettings(inputEnvFile string) error {
	if inputEnvFile != "" {
		envFile = inputEnvFile
	}
	if _, err := os.Stat(envFile); err != nil {
		return err
	}
	if envError := godotenv.Load(envFile); envError != nil {
		return envError
	}
	config.InitEnvConfig()
	return nil
}

func executeCommand(name string) {
	log.Logger().Info("Executing command: " + name)
	found := false
	for _, job := range cronJobs {
		if job.Name == name {
			job.Handler()
			found = true
			break
		}
	}
	if !found {
		log.Logger().Error("Unknown command: " + name)
	}
	log.Logger().Info("Command execution finished")
}

func runCronJob(name string) {
	log.Logger().Info("CronJob triggered: " + name)
	executeCommand(name)
}
