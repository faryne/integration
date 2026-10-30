-- dmm_actress_maps 初始資料（2026-10-31 比對 prod ES 產生）：xcity 同名女優 × 2021 年舊 DMM 女優文件
-- 規則：生日相同，或任一邊沒有生日時三圍相同；只收一對一。共 28 筆，跳過一對多 2 組
-- 執行前請先跑 migration 20261031120000-create_dmm_actress_maps.sql

-- AYA：xcity-3290（生日 1982/2/17、三圍 84/58/86）＝ DMM 30077（生日 1982/2/17、三圍 84/58/86），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('30077', 'xcity', 3290, NOW(), NOW());

-- MIYABI：xcity-5941（生日 1992/5/8、三圍 85/56/86）＝ DMM 1019465（生日 1992/5/8、三圍 85/56/86），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1019465', 'xcity', 5941, NOW(), NOW());

-- みゆき：xcity-2316（生日 1987/4/23、三圍 84/58/86）＝ DMM 21083（生日 1987/4/23、三圍 84/58/86），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('21083', 'xcity', 2316, NOW(), NOW());

-- もなか：xcity-2349（生日 1984/12/3、三圍 88/58/87）＝ DMM 8539（生日 1984/12/3、三圍 88/58/87），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('8539', 'xcity', 2349, NOW(), NOW());

-- 七瀬くるみ：xcity-1225（生日 1984/9/21、三圍 86/60/88）＝ DMM 12083（生日 1984/9/21、三圍 86/60/88），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('12083', 'xcity', 1225, NOW(), NOW());

-- 三枝美憂：xcity-1489（生日 1977/8/7、三圍 83/60/88）＝ DMM 5427（生日 1977/8/7、三圍 82/59/83），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('5427', 'xcity', 1489, NOW(), NOW());

-- 吉田遼子：xcity-11029（生日 1986/11/9、三圍 83/58/88）＝ DMM 1004516（生日 1986/11/9、三圍 83/58/88），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1004516', 'xcity', 11029, NOW(), NOW());

-- 山本梨香子：xcity-4305（生日 1971/4/25、三圍 80/58/93）＝ DMM 3278（生日 1971/4/25、三圍 80/58/83），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('3278', 'xcity', 4305, NOW(), NOW());

-- 市井静香：xcity-2166（生日 1982/7/17、三圍 90/60/87）＝ DMM 1177（生日 無、三圍 90/60/87），依三圍
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1177', 'xcity', 2166, NOW(), NOW());

-- 市川亜紀：xcity-4492（生日 1978/3/8、三圍 92/59/89）＝ DMM 1183（生日 無、三圍 92/59/89），依三圍
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1183', 'xcity', 4492, NOW(), NOW());

-- 愛本美穂：xcity-4449（生日 1973/2/1、三圍 80/58/80）＝ DMM 4468（生日 1973/2/1、三圍 80/58/80），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('4468', 'xcity', 4449, NOW(), NOW());

-- 春野さくら：xcity-2623（生日 1984/3/3、三圍 86/55/85）＝ DMM 6357（生日 無、三圍 86/55/85），依三圍
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('6357', 'xcity', 2623, NOW(), NOW());

-- 春野さくら：xcity-3725（生日 1990/4/20、三圍 85/59/84）＝ DMM 1008446（生日 1990/4/20、三圍 85/59/84），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1008446', 'xcity', 3725, NOW(), NOW());

-- 望月瞳：xcity-1829（生日 1979/6/23、三圍 86/60/89）＝ DMM 7454（生日 1979/6/23、三圍 86/60/89），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('7454', 'xcity', 1829, NOW(), NOW());

-- 木下まこ：xcity-1605（生日 1980/3/3、三圍 98/62/88）＝ DMM 2935（生日 1980/3/3、三圍 98/62/88），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('2935', 'xcity', 1605, NOW(), NOW());

-- 未来：xcity-6336（生日 1993/3/9、三圍 78/56/80）＝ DMM 1021405（生日 1993/3/9、三圍 78/56/80），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1021405', 'xcity', 6336, NOW(), NOW());

-- 桜庭彩：xcity-488（生日 無、三圍 82/56/86）＝ DMM 19138（生日 無、三圍 82/56/86），依三圍
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('19138', 'xcity', 488, NOW(), NOW());

-- 森山愛里：xcity-6101（生日 1971/6/18、三圍 83/60/84）＝ DMM 4493（生日 1971/6/18、三圍 83/60/84），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('4493', 'xcity', 6101, NOW(), NOW());

-- 水卜さくら：xcity-17033（生日 無、三圍 79/52/78）＝ DMM 1038706（生日 無、三圍 79/52/78），依三圍
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1038706', 'xcity', 17033, NOW(), NOW());

-- 水野さやか：xcity-6241（生日 1994/11/3、三圍 86/62/86）＝ DMM 1020416（生日 1994/11/3、三圍 82/55/83），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1020416', 'xcity', 6241, NOW(), NOW());

-- 白鳥慶子：xcity-2562（生日 1971/11/19、三圍 84/58/86）＝ DMM 5779（生日 1971/11/19、三圍 86/60/87），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('5779', 'xcity', 2562, NOW(), NOW());

-- 碧波しずく：xcity-2016（生日 1980/11/25、三圍 80/58/86）＝ DMM 4238（生日 1980/11/25、三圍 80/58/86），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('4238', 'xcity', 2016, NOW(), NOW());

-- 美咲あや：xcity-8179（生日 1996/6/1、三圍 85/60/85）＝ DMM 12478（生日 1996/6/1、三圍 85/60/85），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('12478', 'xcity', 8179, NOW(), NOW());

-- 葉月優：xcity-758（生日 1986/4/25、三圍 85/56/85）＝ DMM 20280（生日 1986/4/25、三圍 85/56/85），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('20280', 'xcity', 758, NOW(), NOW());

-- 設楽あや：xcity-14879（生日 無、三圍 82/57/85）＝ DMM 1022642（生日 無、三圍 82/57/85），依三圍
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1022642', 'xcity', 14879, NOW(), NOW());

-- 鈴音りん：xcity-6141（生日 1994/4/20、三圍 80/61/85）＝ DMM 1021178（生日 1994/4/20、三圍 80/61/85），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1021178', 'xcity', 6141, NOW(), NOW());

-- 高梨あゆみ：xcity-5376（生日 1989/2/4、三圍 83/57/85）＝ DMM 1021122（生日 1989/2/4、三圍 83/57/85），依生日
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1021122', 'xcity', 5376, NOW(), NOW());

-- 高梨あゆみ：xcity-15507（生日 無、三圍 88/60/90）＝ DMM 1013200（生日 無、三圍 88/60/90），依三圍
INSERT INTO `dmm_actress_maps` (`dmm_id`, `domain`, `aid`, `created_at`, `updated_at`) VALUES ('1013200', 'xcity', 15507, NOW(), NOW());
