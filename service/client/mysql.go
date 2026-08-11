package client

import (
	"fmt"
	"time"

	"faryne.dev/model/enum"
	"faryne.dev/service/log"
	"go.uber.org/zap"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/plugin/dbresolver"
)

var mysqlConnections = make(map[enum.DBName]*gorm.DB)

// InitMySql 建立 source（主）連線；若有帶 replicaDSNs，會用 dbresolver 註冊成唯讀複本，
// 之後所有 SELECT 會自動轉去 replica，其餘（含 transaction）維持走 source，呼叫端不用改。
func InitMySql(name enum.DBName, dsn string, replicaDSNs ...string) error {
	if _, ok := mysqlConnections[name]; ok {
		return fmt.Errorf("connection %s already exists", name)
	}
	r, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.New(&log.DBLogger{}, logger.Config{
			SlowThreshold:             time.Millisecond * 500,
			LogLevel:                  logger.Info,
			Colorful:                  true,
			IgnoreRecordNotFoundError: true,
			ParameterizedQueries:      false,
		}),
	})
	if err != nil {
		return err
	}

	db, err := r.DB()
	if err != nil {
		return err
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxIdleTime(5 * time.Minute)
	db.SetConnMaxLifetime(30 * time.Minute)

	if len(replicaDSNs) > 0 {
		replicas := make([]gorm.Dialector, len(replicaDSNs))
		for i, replicaDSN := range replicaDSNs {
			replicas[i] = mysql.Open(replicaDSN)
		}
		if err := r.Use(dbresolver.Register(dbresolver.Config{
			Replicas: replicas,
		}).SetMaxOpenConns(20).SetMaxIdleConns(5).
			SetConnMaxIdleTime(5 * time.Minute).
			SetConnMaxLifetime(30 * time.Minute)); err != nil {
			return err
		}
	}

	mysqlConnections[name] = r
	return nil
}

func GetDB(name enum.DBName) *gorm.DB {
	if _, ok := mysqlConnections[name]; !ok {
		return nil
	}
	return mysqlConnections[name]
}

func CloseMySqlConnections() error {
	for name, conn := range mysqlConnections {
		db, err := conn.DB()
		if err != nil {
			log.Logger().Warn("Get MySQL connection pool failed during shutdown",
				zap.String("name", string(name)),
				zap.Error(err),
			)
			delete(mysqlConnections, name)
			continue
		}
		if err = db.Close(); err != nil {
			log.Logger().Warn("Close MySQL connection pool failed during shutdown",
				zap.String("name", string(name)),
				zap.Error(err),
			)
		}
		delete(mysqlConnections, name)
	}
	return nil
}
