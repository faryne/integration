package main

import (
	"errors"
	"faryne.dev/config"
	"faryne.dev/controller/opendata"
	"faryne.dev/model/enum"
	"faryne.dev/route"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"faryne.dev/service/output"
	"faryne.dev/service/twse"
	"flag"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	recover2 "github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/swagger/v2"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
	"os"
	"reflect"
	"time"

	_ "faryne.dev/docs"
)

var errChan = make(chan error)
var reloadChan = make(chan bool)
var envFile = "./.env"
var inputEnvFile = ""
var reload bool

func main() {
	app := fiber.New(fiber.Config{
		ServerHeader:  "faryne.dev",
		AppName:       "faryne.dev",
		StrictRouting: true,
		CaseSensitive: true,
		UnescapePath:  true,
		BodyLimit:     1024 * 1024 * 1024,
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
	go func() {
		for {
			select {
			case err := <-errChan:
				log.Logger().Panic("Listen and serve error: "+err.Error(), zap.Error(err))
			case <-reloadChan:
				shutdownAllSettings(app, inputEnvFile)
				loadAllSettings(app, inputEnvFile)
			}
		}
	}()

	// 處理 env
	flag.StringVar(&inputEnvFile, "env", "", "path of env file")
	flag.BoolVar(&reload, "reload", false, "reload app")
	flag.Parse()

	if reload {
		reloadChan <- true
		return
	}

	loadAllSettings(app, inputEnvFile)

	select {}
}

func shutdownAllSettings(app *fiber.App, inputEnvFile string) {
	_ = app.Shutdown()
}

func loadAllSettings(app *fiber.App, inputEnvFile string) {
	if inputEnvFile != "" {
		envFile = inputEnvFile
	}
	if _, err := os.Stat(envFile); err == nil {
		if envError := godotenv.Load(envFile); envError != nil {
			errChan <- envError
			return
		}
	} else {
		errChan <- err
		return
	}
	config.InitEnvConfig()

	// 啟動 DB 連線
	connError := client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)
	if connError != nil {
		errChan <- connError
		return
	}
	//redisConnError := client.InitRedis(enum.RedisDefault, config.EnvConfig().RedisDSN)
	//if redisConnError != nil {
	//	errChan <- redisConnError
	//	return
	//}

	esConnError := client.InitElasticSearch(enum.ESDefault, []string{config.EnvConfig().ESDSN})
	if esConnError != nil {
		errChan <- esConnError
		return
	}

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
	app.Get("/dmm/avsearch", opendata.DMMDailyVideo)
	app.Get("/*", swagger.HandlerDefault)
	// </editor-fold>

	// <editor-fold desc="cronjob">
	go func() {
		c := cron.New(cron.WithParser(cron.NewParser(
			cron.SecondOptional | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
		)))

		c.AddFunc("@everyday", twse.CronEtfCodeList)
		c.AddFunc("@everyday", twse.CronETFData)
		c.AddFunc("@everyday", twse.CronETFUpcomingShareDaily)

		c.Start()
	}()
	// </editor-fold>

	go func() {
		errChan <- app.Listen(":" + config.EnvConfig().AppPort)
	}()
}
