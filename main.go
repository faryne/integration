package main

import (
	"faryne.dev/config"
	"faryne.dev/model/enum"
	"faryne.dev/route"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"flag"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/logger"
	recover2 "github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
	"os"
)

var errChan = make(chan error)
var reloadChan = make(chan bool)
var envFile = ".env"
var inputEnvFile = ""
var reload bool

func main() {
	app := fiber.New()
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

	app.Use(recover2.New())
	app.Use(logger.New())
	// <editor-fold desc="">
	route.Nekomaid(app) // nekomaid
	// </editor-fold>

	go func() {
		errChan <- app.Listen(":" + config.EnvConfig().AppPort)
	}()
}
