package fire_department

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestNewTaipei(t *testing.T) {
	resp, err := NewTaipei()
	require.NoError(t, err)
	c, _ := json.Marshal(resp)
	t.Logf("%s", string(c))
	//t.Logf("%+v", resp)
}
