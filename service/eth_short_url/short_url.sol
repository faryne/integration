// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract ShortURLStorage {
    // 短碼到長網址的映射
    mapping(string => string) private shortToLong;

    struct ClickEvent {
        uint256 ts;
    }
    
    // 事件：記錄短網址建立
    event URLShortened(string indexed shortCode, string longUrl);
    event URLClicked(string indexed shortCode, ClickEvent e);
    
    // 設定短網址 (外部呼叫)
    function setURL(string calldata shortCode, string calldata longUrl) external {
        require(
            bytes(shortCode).length > 0 && 
            bytes(longUrl).length > 0 && 
            bytes(shortToLong[shortCode]).length == 0, unicode"無效的輸入");
        
        shortToLong[shortCode] = longUrl;
        emit URLShortened(shortCode, longUrl);
    }

    // 記錄點擊
    function clickURL(string calldata shortCode, ClickEvent calldata e) external {
        emit URLClicked(shortCode, e);
    }
    
    // 查詢長網址 (只讀，不消耗 gas)
    function getURL(string calldata shortCode) external view returns (string memory) {
        return shortToLong[shortCode];
    }
}