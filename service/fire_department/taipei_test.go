package fire_department

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestTaipei(t *testing.T) {
	resp, err := Taipei()
	require.NoError(t, err)
	c, _ := json.Marshal(resp)
	t.Logf("%s", string(c))
	//t.Logf("resp:%v", resp)
}
