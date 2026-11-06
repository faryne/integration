package mail

import (
	"context"

	"faryne.dev/config"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

// sesSender 透過 Amazon SES v2 寄信。寄件網域要先在 SES 完成驗證（DKIM），
// 帳號也要申請脫離 sandbox，否則只能寄給已驗證的信箱
type sesSender struct {
	client *sesv2.Client
	// configurationSet 留空就不帶；有設時可在 SES 追蹤退信、投訴
	configurationSet string
}

func newSESSender(ctx context.Context) (sender, error) {
	cfg := config.EnvConfig()
	// 跟 S3 共用同一把 key 與 region（SES 權限掛在那把 key 上）；沒設 key 就走 AWS 預設憑證鏈
	options := []func(*awsconfig.LoadOptions) error{awsconfig.WithRegion(cfg.S3Region)}
	if cfg.S3AccessKey != "" && cfg.S3SecretKey != "" {
		options = append(options, awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.S3AccessKey, cfg.S3SecretKey, "")))
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, options...)
	if err != nil {
		return nil, err
	}
	return &sesSender{client: sesv2.NewFromConfig(awsCfg), configurationSet: cfg.SESConfigurationSet}, nil
}

func (s *sesSender) send(ctx context.Context, msg Message) error {
	_, err := s.client.SendEmail(ctx, buildSESInput(msg, s.configurationSet))
	return err
}

// buildSESInput 組 SendEmail 參數；主旨與內文一律標 UTF-8，中文才不會變亂碼
func buildSESInput(msg Message, configurationSet string) *sesv2.SendEmailInput {
	utf8 := func(v string) *types.Content {
		return &types.Content{Data: aws.String(v), Charset: aws.String("UTF-8")}
	}
	body := &types.Body{}
	if msg.HTML != "" {
		body.Html = utf8(msg.HTML)
	}
	if msg.Text != "" {
		body.Text = utf8(msg.Text)
	}
	input := &sesv2.SendEmailInput{
		FromEmailAddress: aws.String(msg.From),
		Destination:      &types.Destination{ToAddresses: msg.To},
		ReplyToAddresses: msg.ReplyTo,
		Content:          &types.EmailContent{Simple: &types.Message{Subject: utf8(msg.Subject), Body: body}},
	}
	if configurationSet != "" {
		input.ConfigurationSetName = aws.String(configurationSet)
	}
	return input
}
