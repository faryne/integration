package enum

// AMQPName 是 AMQP 連線的名稱，對應 client.InitAMQP／GetAMQP
type AMQPName string

const (
	AMQPDefault AMQPName = "default"
)

// AMQPMessageType 是佇列訊息的業務種類，consumer 依此決定 Payload 要解成哪個型別。
// 命名慣例「<產品線>.<用途>」，例如 storyteller.notification；Payload 結構有不相容的改動時
// 開新的 Type（例如加上 .v2）而不是改舊的，讓還沒部署新版的 consumer 不會解錯。
type AMQPMessageType string

const (
	// AMQPMessageSteamLoomProjectCreated SteamLoom 作者建立新專案
	AMQPMessageSteamLoomProjectCreated AMQPMessageType = "steamloom.project_created"
)

// AMQPQueueSteamLoom 是 SteamLoom 業務事件共用的佇列；同一佇列混放多種 AMQPMessageType，
// 由 mq.Dispatch 依 Type 分派給各自註冊的 handler。
const AMQPQueueSteamLoom = "steamloom.events"
