package taipower

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClassifyPurpose(t *testing.T) {
	tests := map[string]string{
		"辦理急難救助":    purposeSocialAid,
		"發放清寒學生獎學金": purposeUnclassified,
		"發放學生獎學金":   purposeEducation,
		"辦理社區節慶活動":  purposeCommunity,
		"辦理路燈設備更新":  purposePublicFacilities,
		"辦理節約用電宣導":  purposeEnergy,
		"辦理節約能源宣導":  purposeEnergy,
		"辦理會員大會":    purposeCommunity,
		"辦理會員活動":    purposeUnclassified,
	}
	for summary, expected := range tests {
		require.Equal(t, expected, classifyPurpose(summary), summary)
	}
}
