-- +migrate Up
-- 回填舊資料的價格快照：只補「查得到目前價格」的既有紀錄（allow_custom_model=0
-- 的固定模型清單供應商），self_hosted／openrouter 或已經下架、從沒同步過價格的
-- model 維持 NULL，不猜成本。注意這是拿「現在」的價目表回填「過去」的紀錄，
-- 跟之後每筆新紀錄寫入當下快照的精神不同——舊資料本來就沒留下當時的價格，這是
-- 目前能做到最好的估算，不是真正的當時價格。
UPDATE storyteller_agent_usage_logs AS logs
JOIN storyteller_agent_providers AS providers
    ON providers.provider = logs.provider AND providers.allow_custom_model = 0
JOIN storyteller_agent_models AS models
    ON models.provider_id = providers.id AND models.name = logs.model_name
SET logs.price = models.price
WHERE logs.price IS NULL AND models.price IS NOT NULL;

-- +migrate Down
-- 純資料回填，無法可靠復原（回填前不會知道哪些欄位「本來就是 NULL」而哪些是
-- 這次回填寫入的），不做任何事。
SELECT 1;
