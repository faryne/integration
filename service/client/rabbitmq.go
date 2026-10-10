package client

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"faryne.dev/config"
	"faryne.dev/model/enum"
	"faryne.dev/service/log"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

const (
	rabbitMQDialTimeout = 10 * time.Second
	rabbitMQMinBackoff  = time.Second
	rabbitMQMaxBackoff  = 30 * time.Second
)

// ErrRabbitMQNotConnected 代表目前沒有可用連線（啟動時連不上，或斷線後還在重連）；
// 呼叫端應視為暫時性錯誤，稍後重試即可。
var ErrRabbitMQNotConnected = errors.New("rabbitmq is not connected")

var rabbitMQConnections = make(map[enum.RabbitMQName]*RabbitMQ)

// RabbitMQ 包住一條會自動重連的 AMQP 連線。amqp091-go 本身不會重連，
// 所以由背景 goroutine 監聽 NotifyClose，斷線後以指數退避重新連線。
// 整個 process 共用一條連線，各 producer／consumer 再各自開 channel，
// 避免吃掉 CloudAMQP 免費方案有限的連線數。
type RabbitMQ struct {
	url  string
	name enum.RabbitMQName
	cfg  amqp.Config

	mu   sync.RWMutex
	conn *amqp.Connection

	closeOnce sync.Once
	done      chan struct{} // Close() 時關閉，通知背景重連迴圈結束
	stopped   chan struct{} // 背景迴圈結束（連線已關閉）後關閉
}

// InitRabbitMQ 建立連線並啟動背景重連；啟動當下連不上只記 log、不擋 app 開機，
// 因為佇列目前只承載通知等非關鍵的非同步工作。URL 格式錯誤才直接回傳錯誤。
func InitRabbitMQ(name enum.RabbitMQName, url string) error {
	if _, ok := rabbitMQConnections[name]; ok {
		return fmt.Errorf("connection %s already exists", name)
	}
	if _, err := amqp.ParseURI(url); err != nil {
		return fmt.Errorf("invalid rabbitmq url: %w", err)
	}
	r := &RabbitMQ{
		url:  url,
		name: name,
		cfg: amqp.Config{
			Heartbeat: 10 * time.Second,
			Dial:      amqp.DefaultDial(rabbitMQDialTimeout),
			// connection_name 會顯示在 CloudAMQP / management UI，方便分辨是哪個環境連進來的
			Properties: amqp.Table{"connection_name": "faryne.dev-" + config.EnvConfig().AppEnvironment},
		},
		done:    make(chan struct{}),
		stopped: make(chan struct{}),
	}
	conn, err := r.dial()
	if err != nil {
		log.Logger().Warn("Connect RabbitMQ failed, retrying in background", zap.String("name", string(name)), zap.Error(err))
	}
	// 先寫入再啟動背景迴圈，否則 Init 一返回就呼叫 Channel() 會因 goroutine 還沒跑到而拿到 nil
	r.conn = conn
	go r.run(conn)
	rabbitMQConnections[name] = r
	return nil
}

func GetRabbitMQ(name enum.RabbitMQName) *RabbitMQ {
	return rabbitMQConnections[name]
}

func CloseRabbitMQConnections() error {
	for name, conn := range rabbitMQConnections {
		conn.Close()
		delete(rabbitMQConnections, name)
	}
	return nil
}

// Channel 在目前的連線上開一個新 channel；channel 不可跨 goroutine 共用發佈，
// 由呼叫端自行管理生命週期（用完 Close，斷線後重新取得）。
func (r *RabbitMQ) Channel() (*amqp.Channel, error) {
	r.mu.RLock()
	conn := r.conn
	r.mu.RUnlock()
	if conn == nil || conn.IsClosed() {
		return nil, ErrRabbitMQNotConnected
	}
	return conn.Channel()
}

// Close 停止重連並關閉連線，會等背景迴圈結束才返回，確保關機時連線已正常釋放。
func (r *RabbitMQ) Close() {
	r.closeOnce.Do(func() { close(r.done) })
	<-r.stopped
}

// dial 連線失敗時 amqp091 仍可能回傳一個已失效的非 nil *Connection，這裡統一轉成 nil，
// 否則重連迴圈會把它當成連上而重置退避時間。
func (r *RabbitMQ) dial() (*amqp.Connection, error) {
	conn, err := amqp.DialConfig(r.url, r.cfg)
	if err != nil {
		return nil, err
	}
	return conn, nil
}

// run 是背景重連迴圈：conn 為 nil 代表尚未連上或剛斷線，等待退避時間後重連；
// 連上後阻塞在 NotifyClose，直到斷線或 Close()。
func (r *RabbitMQ) run(conn *amqp.Connection) {
	defer close(r.stopped)
	backoff := rabbitMQMinBackoff
	for {
		if conn == nil {
			select {
			case <-r.done:
				return
			case <-time.After(backoff):
			}
			var err error
			if conn, err = r.dial(); err != nil {
				log.Logger().Warn("Reconnect RabbitMQ failed", zap.String("name", string(r.name)), zap.Duration("backoff", backoff), zap.Error(err))
				backoff = min(backoff*2, rabbitMQMaxBackoff)
				continue
			}
			log.Logger().Info("RabbitMQ reconnected", zap.String("name", string(r.name)))
		}
		backoff = rabbitMQMinBackoff
		r.mu.Lock()
		r.conn = conn
		r.mu.Unlock()

		closed := conn.NotifyClose(make(chan *amqp.Error, 1))
		select {
		case <-r.done:
			if err := conn.Close(); err != nil && !errors.Is(err, amqp.ErrClosed) {
				log.Logger().Warn("Close RabbitMQ connection failed during shutdown", zap.String("name", string(r.name)), zap.Error(err))
			}
			return
		case err := <-closed:
			log.Logger().Warn("RabbitMQ connection closed, reconnecting", zap.String("name", string(r.name)), zap.Error(err))
			conn = nil
		}
	}
}
