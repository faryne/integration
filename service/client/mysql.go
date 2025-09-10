package client

import (
	"faryne.dev/model/enum"
	"fmt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var mysqlConnections = make(map[enum.DBName]*gorm.DB)

func InitMySql(name enum.DBName, dsn string) error {
	if _, ok := mysqlConnections[name]; ok {
		return fmt.Errorf("connection %s already exists", name)
	}
	r, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
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
