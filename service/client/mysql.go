package client

import (
	"faryne.dev/model/enum"
	"faryne.dev/service/log"
	"fmt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"time"
)

var mysqlConnections = make(map[enum.DBName]*gorm.DB)

func InitMySql(name enum.DBName, dsn string) error {
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
	mysqlConnections[name] = r
	return nil
}

func GetDB(name enum.DBName) *gorm.DB {
	if _, ok := mysqlConnections[name]; !ok {
		return nil
	}
	return mysqlConnections[name]
}
