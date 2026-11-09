package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	commandParameter "faryne.dev/cmd/parameter"
	"faryne.dev/config"
	"faryne.dev/controller/opendata"
	storytellerAuditMiddleware "faryne.dev/middleware/storytelleraudit"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/model/enum"
	storytellerRepo "faryne.dev/repository/storyteller"
	"faryne.dev/route"
	"faryne.dev/service/background"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"faryne.dev/service/mq"
	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	storytellerAudit "faryne.dev/service/storytelleraudit"
	storytellerNotify "faryne.dev/service/storytellernotify"
	"faryne.dev/service/validation"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/logger"
	recover2 "github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

var envFile = "./.env"
var inputEnvFile = ""
var reload bool
var buildVersion = "development"
var cmdName = ""
var appBackgroundWork = background.Default()

var commandParams = commandParameter.Registry{
	"bank":            commandParameter.New("rates service_name to fetch, e.g. esun; empty for all banks", nil),
	"brandId":         commandParameter.New("eroge_brands numeric ID", nil),
	"brandIds":        commandParameter.New("comma-separated eroge_brands numeric IDs, or all for every approved brand", nil),
	"brandName":       commandParameter.New("eroge brand name", nil),
	"csvFile":         commandParameter.New("path to a pipe-delimited eroge brand CSV file", nil),
	"dayFrom":         commandParameter.New("start date in YYYY-MM-DD format", commandParameter.Date),
	"dayTo":           commandParameter.New("end date in YYYY-MM-DD format (inclusive)", commandParameter.Date),
	"days":            commandParameter.New("number of days ahead for av-upcoming-sync (default 30; smaller for local testing)", nil),
	"ncccKey":         commandParameter.New("single NCCC data set key, e.g. gender", nil),
	"searchIndexName": commandParameter.New("optional Elasticsearch index name for storyteller search; defaults to STORYTELLER_SEARCH_INDEX", nil),
	"playlist":        commandParameter.New("public YouTube playlist URL or ID", nil),
	"youtubeChannel":  commandParameter.New("YouTube @handle or UC... channel ID", nil),
	"youtubeURL":      commandParameter.New("YouTube brand page URL", nil),
	"yearMonthFrom":   commandParameter.New("start month in YYYY-MM format", commandParameter.YearMonth),
	"yearMonthTo":     commandParameter.New("end month in YYYY-MM format", commandParameter.YearMonth),
}

type appRuntime struct {
	app           *fiber.App
	cron          *cron.Cron
	auditConsumer *storytellerAudit.Consumer
	// steamloomConsumer 消費 SteamLoom 業務事件佇列；沒設 AMQP_URL 時為 nil
	steamloomConsumer *mq.Consumer
	listenErr         chan error
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
		ProxyHeader:     "X-Real-IP",
		TrustProxy:      true,
		TrustProxyConfig: fiber.TrustProxyConfig{
			Proxies: []string{"127.0.0.1", "::1"},
		},
		ErrorHandler: func(ctx fiber.Ctx, err error) error {
			// Fiber 內建錯誤（例如沒有對應路由時的 fiber.ErrNotFound）先轉成標準格式，
			// 否則會落到最下面的 ctx.JSON，以 HTTP 200 回傳 "Not Found" 字串，前端會誤判成成功。
			if fiberErr, ok := errors.AsType[*fiber.Error](err); ok {
				err = output.FromFiberError(fiberErr)
			}
			// 用 errors.AsType 判斷是否完整實作 CommonOutputInterface，不能只看有沒有 HttpCode 方法，
			// 否則只實作一半的型別會讓 v 留在 nil，呼叫 v.Output 時 panic
			if v, ok := errors.AsType[output.CommonOutputInterface](err); ok {
				finalOutput := output.FromContext(ctx, v)
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
		// 指令可能留下背景工作（例如通知的 AMQP 非同步發佈），要等它們送完才能關連線，否則訊息會遺失
		beginBackgroundWorkDrain()
		waitBackgroundWorkBeforeShutdown()
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

	// 重啟前置檢查失敗時 restart 回傳 true，此時照常進入 waitForSignal 繼續服務
	if reload && !restart(runtime) {
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
				if restart(runtime) {
					continue
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

// shutdownTimeout 是 HTTP 與 cron 收尾共用的等待上限；兩者並行等待，
// 避免序列執行時最壞要 60 秒、超過部署平台常見的 30 秒 graceful shutdown 窗口而被 SIGKILL
const shutdownTimeout = 30 * time.Second

func shutdownAllSettings(runtime *appRuntime) error {
	if runtime == nil {
		return nil
	}
	beginBackgroundWorkDrain()
	var wg sync.WaitGroup
	var appErr, cronErr error
	if runtime.app != nil {
		wg.Go(func() { appErr = runtime.app.ShutdownWithTimeout(shutdownTimeout) })
	}
	if runtime.cron != nil {
		wg.Go(func() {
			select {
			case <-runtime.cron.Stop().Done():
			case <-time.After(shutdownTimeout):
				cronErr = errors.New("cron shutdown timeout")
			}
		})
	}
	wg.Wait()
	shutdownErr := errors.Join(appErr, cronErr)
	// consumer 等 HTTP 與 cron 都收完才停，讓它們最後產生的事件仍有機會被消費；
	// 且要在 shutdownClients 關掉 AMQP 連線之前停掉
	if runtime.auditConsumer != nil {
		runtime.auditConsumer.Stop()
	}
	runtime.steamloomConsumer.Stop()
	waitBackgroundWorkBeforeShutdown()
	return errors.Join(shutdownErr, shutdownClients())
}

func beginBackgroundWorkDrain() {
	appBackgroundWork.BeginDrain()
}

func waitBackgroundWorkBeforeShutdown() {
	// 背景工作持有的是 appBackgroundWork.Context()，重啟時必須先等它們自然完成，
	// 不能先 cancel，否則長時間的 provider 呼叫會被我們自己中斷。
	appBackgroundWork.Wait()
	appBackgroundWork.Cancel()
}

func shutdownClients() error {
	var shutdownErr error
	shutdownErr = errors.Join(shutdownErr, client.CloseAMQPConnections())
	shutdownErr = errors.Join(shutdownErr, client.CloseRedisConnections())
	shutdownErr = errors.Join(shutdownErr, client.CloseMySqlConnections())
	return shutdownErr
}

// errRestartAborted 代表重啟在關閉任何資源之前就放棄了，服務仍完整可用
var errRestartAborted = errors.New("restart aborted before shutdown")

// restart 執行重啟並處理失敗：回傳 true 代表前置檢查沒過、應繼續服務；
// 資源關閉後才失敗則已無法挽回，直接 Panic。exec 成功時不會回到這裡。
func restart(runtime *appRuntime) (keepServing bool) {
	logBuildEvent("restart")
	err := gracefulRestart(runtime)
	if errors.Is(err, errRestartAborted) {
		log.Logger().Error("Graceful restart aborted, keep serving: " + err.Error())
		return true
	}
	if err != nil {
		log.Logger().Panic("Graceful restart failed: " + err.Error())
	}
	return false
}

func gracefulRestart(runtime *appRuntime) error {
	// 先確認執行檔可用才關資源：部署途中執行檔可能暫時不存在，若先關光 HTTP/DB 再 exec 失敗，服務就直接掛掉
	path, err := restartExecutable()
	if err != nil {
		return fmt.Errorf("%w: %w", errRestartAborted, err)
	}
	if err := shutdownAllSettings(runtime); err != nil {
		return err
	}
	// 重啟後不應再帶 -reload，否則新 process 開機完會立刻判斷 reload==true 再次重啟，造成無限迴圈
	return syscall.Exec(path, argsWithoutReload(), os.Environ())
}

// restartExecutable 回傳目前執行檔路徑，並確認該路徑上仍是可執行的一般檔案。
// Linux 上即使舊檔已被替換，os.Executable 也會回傳原路徑（去掉 " (deleted)" 後綴），所以這裡檢查到的是新檔。
func restartExecutable() (string, error) {
	path, err := os.Executable()
	if err != nil {
		return "", err
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	if !info.Mode().IsRegular() || info.Mode().Perm()&0o111 == 0 {
		return "", fmt.Errorf("%s is not an executable file", path)
	}
	return path, nil
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
	auditRepository := storytellerRepo.NewRepository()
	redisClient := client.GetRedis(enum.RedisDefault)
	auditConsumer := storytellerAudit.NewConsumer(redisClient, auditRepository, appBackgroundWork)
	if auditConsumer != nil {
		if err := auditConsumer.Start(); err != nil {
			return nil, err
		}
	}

	// consumer 只在常駐後端啟動（-cmd 不消費）；handler 必須在 Start 之前註冊完
	storytellerNotify.RegisterAMQPHandlers()
	steamloomConsumer := mq.NewConsumer(mq.Default(), enum.AMQPQueueSteamLoom, mq.Dispatch)
	steamloomConsumer.Start()

	// 記錄開始時間
	app.Use(func(c fiber.Ctx) error {
		c.Locals("start_time", time.Now().UnixMilli())
		return c.Next()
	})
	app.Use(recover2.New())
	app.Use(logger.New())
	app.Use(corsMiddleware())
	app.Use(storytellerAuditMiddleware.NewRequestContext())
	app.Use(maintenanceMiddleware())
	// <editor-fold desc="">
	route.Nekomaid(app) // nekomaid
	route.OpenData(app)
	route.Joyu(app) // joyu.fyi 登入後的個人 API（追蹤）
	route.Tools(app)
	route.Auth(app)
	route.SNS(app)
	route.MCP(app)
	route.Galgame(app)
	route.Storyteller(app)
	route.StorytellerMCP(app)
	route.StorytellerOAuth(app)
	app.Get("/dmm/avsearch", opendata.DMMDailyVideo)
	route.Swagger(app)
	logStorytellerAuditCoverage(app)
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
			// schedule 打錯時 AddFunc 會回錯誤、job 不會註冊；只記 log 不擋開機，避免一支 job 拖垮整個服務
			if _, err := c.AddFunc(job.Schedule, func() { runCronJob(jobName) }); err != nil {
				log.Logger().Error("Register cron job failed", zap.String("job", jobName), zap.String("schedule", job.Schedule), zap.Error(err))
			}
		}
	}

	c.Start()
	// 台灣指標資料方塊在背景先載入一次，失敗時由 tw-stats-refresh 排程每小時重試
	go runCronJob("tw-stats-refresh")
	// </editor-fold>

	listenErr := make(chan error, 1)
	go func() {
		listenErr <- app.Listen(":" + config.EnvConfig().AppPort)
	}()

	return &appRuntime{
		app:               app,
		cron:              c,
		auditConsumer:     auditConsumer,
		steamloomConsumer: steamloomConsumer,
		listenErr:         listenErr,
	}, nil
}

func logStorytellerAuditCoverage(app *fiber.App) {
	if config.EnvConfig().IsProduction() {
		return
	}
	routes := make([]storytellerModel.AuditRouteRef, 0)
	for _, registered := range app.GetRoutes() {
		routes = append(routes, storytellerModel.AuditRouteRef{Method: registered.Method, Path: registered.Path})
	}
	tools := make([]string, 0)
	for _, registry := range []*storytellerService.ToolRegistry{storytellerService.StorytellerToolRegistry(), storytellerService.StorytellerMCPOnlyToolRegistry()} {
		for _, tool := range registry.All() {
			tools = append(tools, tool.Name)
		}
	}
	if unmapped := storytellerAudit.CheckCoverage(routes, tools); len(unmapped) > 0 {
		log.Logger().Warn("Storyteller audit registry has unmapped routes or tools", zap.Strings("unmapped", unmapped))
	}
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

	// AMQP broker 連不上不會擋開機（背景自動重連），只有 URL 格式錯誤才會回傳錯誤
	if config.EnvConfig().AMQPURL != "" {
		if err := client.InitAMQP(enum.AMQPDefault, config.EnvConfig().AMQPURL); err != nil {
			_ = client.CloseRedisConnections()
			_ = client.CloseMySqlConnections()
			return err
		}
		// 預設佇列給 mq.PublishAsync 用，-cmd 與常駐後端共用；沒設 AMQP_URL 時不設定，發佈皆為 no-op
		mq.SetDefault(mq.NewAMQP(client.GetAMQP(enum.AMQPDefault)))
	}

	// 稽核事件的 producer 在這裡設定，常駐後端與手動 -cmd 共用：事件寫進 Redis Stream，
	// 由常駐後端的 consumer 寫進 MySQL（正式環境兩者共用同一組 Redis）；Redis 沒設定或寫不進去時，
	// producer 會改成直接寫 MySQL。少了這段，-cmd 執行的排程會留不下 system.* 稽核事件。
	storytellerAudit.SetDefaultProducer(storytellerAudit.NewProducer(client.GetRedis(enum.RedisDefault), storytellerRepo.NewRepository()))

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
