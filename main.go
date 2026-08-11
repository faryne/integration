package main

import (
	"errors"
	"flag"
	"os"
	"os/signal"
	"reflect"
	"strings"
	"syscall"
	"time"

	commandParameter "faryne.dev/cmd/parameter"
	"faryne.dev/config"
	"faryne.dev/controller/opendata"
	"faryne.dev/model/enum"
	"faryne.dev/route"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"faryne.dev/service/output"
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

var commandParams = commandParameter.Registry{
	"brandId":         commandParameter.New("eroge_brands numeric ID", nil),
	"brandIds":        commandParameter.New("comma-separated eroge_brands numeric IDs, or all for every approved brand", nil),
	"brandName":       commandParameter.New("eroge brand name", nil),
	"csvFile":         commandParameter.New("path to a pipe-delimited eroge brand CSV file", nil),
	"ncccKey":         commandParameter.New("single NCCC data set key, e.g. gender", nil),
	"searchIndexName": commandParameter.New("optional Elasticsearch index name for storyteller search; defaults to STORYTELLER_SEARCH_INDEX", nil),
	"playlist":        commandParameter.New("public YouTube playlist URL or ID", nil),
	"youtubeChannel":  commandParameter.New("YouTube @handle or UC... channel ID", nil),
	"youtubeURL":      commandParameter.New("YouTube brand page URL", nil),
	"yearMonthFrom":   commandParameter.New("start month in YYYY-MM format", commandParameter.YearMonth),
	"yearMonthTo":     commandParameter.New("end month in YYYY-MM format", commandParameter.YearMonth),
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
	commandParams.Register(flag.CommandLine)
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
	// 重啟後不應再帶 -reload，否則新 process 開機完會立刻判斷 reload==true 再次重啟，造成無限迴圈
	return syscall.Exec(path, argsWithoutReload(), os.Environ())
}

func argsWithoutReload() []string {
	args := make([]string, 0, len(os.Args))
	for _, a := range os.Args {
		if a == "-reload" || a == "--reload" || strings.HasPrefix(a, "-reload=") || strings.HasPrefix(a, "--reload=") {
			continue
		}
		args = append(args, a)
	}
	return args
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
	app.Use(cors.New(cors.Config{
		ExposeHeaders: []string{"X-Session-Expires-At"},
	}))
	// <editor-fold desc="">
	route.Nekomaid(app) // nekomaid
	route.OpenData(app)
	route.Tools(app)
	route.Auth(app)
	route.SNS(app)
	route.MCP(app)
	route.Galgame(app)
	route.Storyteller(app)
	route.StorytellerMCP(app)
	app.Get("/dmm/avsearch", opendata.DMMDailyVideo)
	route.Swagger(app)
	// </editor-fold>

	// <editor-fold desc="cronjob">
	c := cron.New(cron.WithParser(cron.NewParser(
		cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
	)))

	for _, group := range cronJobs {
		if !group.Enabled {
			continue
		}
		for _, job := range group.Jobs {
			if job.Schedule == "" || !job.Enabled {
				continue
			}
			jobName := job.Name
			c.AddFunc(job.Schedule, func() {
				runCronJob(jobName)
			})
		}
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
		var replicaDSNs []string
		if key == enum.DBWalolita && config.EnvConfig().WalolitaSlaveDSN != "" {
			replicaDSNs = append(replicaDSNs, config.EnvConfig().WalolitaSlaveDSN)
		}
		connError := client.InitMySql(key, conn, replicaDSNs...)
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
