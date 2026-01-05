package client

import (
	"faryne.dev/model/enum"
	"github.com/elastic/go-elasticsearch/v7"
)

var elasticsearchClients = make(map[enum.ESName]*elasticsearch.Client)

func InitElasticSearch(name enum.ESName, servers []string) error {
	client, err := elasticsearch.NewClient(elasticsearch.Config{
		Addresses: servers,
	})
	if err != nil {
		return err
	}
	elasticsearchClients[name] = client
	return nil
}

func GetElasticSearch(name enum.ESName) *elasticsearch.Client {
	if _, ok := elasticsearchClients[name]; !ok {
		return nil
	}
	return elasticsearchClients[name]
}
