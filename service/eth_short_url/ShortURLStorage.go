// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package eth_short_url

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
	_ = abi.ConvertType
)

// ShortURLStorageClickEvent is an auto generated low-level Go binding around an user-defined struct.
type ShortURLStorageClickEvent struct {
	Ts *big.Int
}

// ShortURLStorageMetaData contains all meta data concerning the ShortURLStorage contract.
var ShortURLStorageMetaData = &bind.MetaData{
	ABI: "[{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"string\",\"name\":\"shortCode\",\"type\":\"string\"},{\"components\":[{\"internalType\":\"uint256\",\"name\":\"ts\",\"type\":\"uint256\"}],\"indexed\":false,\"internalType\":\"structShortURLStorage.ClickEvent\",\"name\":\"e\",\"type\":\"tuple\"}],\"name\":\"URLClicked\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"string\",\"name\":\"shortCode\",\"type\":\"string\"},{\"indexed\":false,\"internalType\":\"string\",\"name\":\"longUrl\",\"type\":\"string\"}],\"name\":\"URLShortened\",\"type\":\"event\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"shortCode\",\"type\":\"string\"},{\"components\":[{\"internalType\":\"uint256\",\"name\":\"ts\",\"type\":\"uint256\"}],\"internalType\":\"structShortURLStorage.ClickEvent\",\"name\":\"e\",\"type\":\"tuple\"}],\"name\":\"clickURL\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"shortCode\",\"type\":\"string\"}],\"name\":\"getURL\",\"outputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"shortCode\",\"type\":\"string\"},{\"internalType\":\"string\",\"name\":\"longUrl\",\"type\":\"string\"}],\"name\":\"setURL\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]",
}

// ShortURLStorageABI is the input ABI used to generate the binding from.
// Deprecated: Use ShortURLStorageMetaData.ABI instead.
var ShortURLStorageABI = ShortURLStorageMetaData.ABI

// ShortURLStorage is an auto generated Go binding around an Ethereum contract.
type ShortURLStorage struct {
	ShortURLStorageCaller     // Read-only binding to the contract
	ShortURLStorageTransactor // Write-only binding to the contract
	ShortURLStorageFilterer   // Log filterer for contract events
}

// ShortURLStorageCaller is an auto generated read-only Go binding around an Ethereum contract.
type ShortURLStorageCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// ShortURLStorageTransactor is an auto generated write-only Go binding around an Ethereum contract.
type ShortURLStorageTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// ShortURLStorageFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type ShortURLStorageFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// ShortURLStorageSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type ShortURLStorageSession struct {
	Contract     *ShortURLStorage  // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// ShortURLStorageCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type ShortURLStorageCallerSession struct {
	Contract *ShortURLStorageCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts          // Call options to use throughout this session
}

// ShortURLStorageTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type ShortURLStorageTransactorSession struct {
	Contract     *ShortURLStorageTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts          // Transaction auth options to use throughout this session
}

// ShortURLStorageRaw is an auto generated low-level Go binding around an Ethereum contract.
type ShortURLStorageRaw struct {
	Contract *ShortURLStorage // Generic contract binding to access the raw methods on
}

// ShortURLStorageCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type ShortURLStorageCallerRaw struct {
	Contract *ShortURLStorageCaller // Generic read-only contract binding to access the raw methods on
}

// ShortURLStorageTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type ShortURLStorageTransactorRaw struct {
	Contract *ShortURLStorageTransactor // Generic write-only contract binding to access the raw methods on
}

// NewShortURLStorage creates a new instance of ShortURLStorage, bound to a specific deployed contract.
func NewShortURLStorage(address common.Address, backend bind.ContractBackend) (*ShortURLStorage, error) {
	contract, err := bindShortURLStorage(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &ShortURLStorage{ShortURLStorageCaller: ShortURLStorageCaller{contract: contract}, ShortURLStorageTransactor: ShortURLStorageTransactor{contract: contract}, ShortURLStorageFilterer: ShortURLStorageFilterer{contract: contract}}, nil
}

// NewShortURLStorageCaller creates a new read-only instance of ShortURLStorage, bound to a specific deployed contract.
func NewShortURLStorageCaller(address common.Address, caller bind.ContractCaller) (*ShortURLStorageCaller, error) {
	contract, err := bindShortURLStorage(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &ShortURLStorageCaller{contract: contract}, nil
}

// NewShortURLStorageTransactor creates a new write-only instance of ShortURLStorage, bound to a specific deployed contract.
func NewShortURLStorageTransactor(address common.Address, transactor bind.ContractTransactor) (*ShortURLStorageTransactor, error) {
	contract, err := bindShortURLStorage(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &ShortURLStorageTransactor{contract: contract}, nil
}

// NewShortURLStorageFilterer creates a new log filterer instance of ShortURLStorage, bound to a specific deployed contract.
func NewShortURLStorageFilterer(address common.Address, filterer bind.ContractFilterer) (*ShortURLStorageFilterer, error) {
	contract, err := bindShortURLStorage(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &ShortURLStorageFilterer{contract: contract}, nil
}

// bindShortURLStorage binds a generic wrapper to an already deployed contract.
func bindShortURLStorage(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := ShortURLStorageMetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_ShortURLStorage *ShortURLStorageRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _ShortURLStorage.Contract.ShortURLStorageCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_ShortURLStorage *ShortURLStorageRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _ShortURLStorage.Contract.ShortURLStorageTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_ShortURLStorage *ShortURLStorageRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _ShortURLStorage.Contract.ShortURLStorageTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_ShortURLStorage *ShortURLStorageCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _ShortURLStorage.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_ShortURLStorage *ShortURLStorageTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _ShortURLStorage.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_ShortURLStorage *ShortURLStorageTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _ShortURLStorage.Contract.contract.Transact(opts, method, params...)
}

// GetURL is a free data retrieval call binding the contract method 0xdd392a55.
//
// Solidity: function getURL(string shortCode) view returns(string)
func (_ShortURLStorage *ShortURLStorageCaller) GetURL(opts *bind.CallOpts, shortCode string) (string, error) {
	var out []interface{}
	err := _ShortURLStorage.contract.Call(opts, &out, "getURL", shortCode)

	if err != nil {
		return *new(string), err
	}

	out0 := *abi.ConvertType(out[0], new(string)).(*string)

	return out0, err

}

// GetURL is a free data retrieval call binding the contract method 0xdd392a55.
//
// Solidity: function getURL(string shortCode) view returns(string)
func (_ShortURLStorage *ShortURLStorageSession) GetURL(shortCode string) (string, error) {
	return _ShortURLStorage.Contract.GetURL(&_ShortURLStorage.CallOpts, shortCode)
}

// GetURL is a free data retrieval call binding the contract method 0xdd392a55.
//
// Solidity: function getURL(string shortCode) view returns(string)
func (_ShortURLStorage *ShortURLStorageCallerSession) GetURL(shortCode string) (string, error) {
	return _ShortURLStorage.Contract.GetURL(&_ShortURLStorage.CallOpts, shortCode)
}

// ClickURL is a paid mutator transaction binding the contract method 0xb65384cb.
//
// Solidity: function clickURL(string shortCode, (uint256) e) returns()
func (_ShortURLStorage *ShortURLStorageTransactor) ClickURL(opts *bind.TransactOpts, shortCode string, e ShortURLStorageClickEvent) (*types.Transaction, error) {
	return _ShortURLStorage.contract.Transact(opts, "clickURL", shortCode, e)
}

// ClickURL is a paid mutator transaction binding the contract method 0xb65384cb.
//
// Solidity: function clickURL(string shortCode, (uint256) e) returns()
func (_ShortURLStorage *ShortURLStorageSession) ClickURL(shortCode string, e ShortURLStorageClickEvent) (*types.Transaction, error) {
	return _ShortURLStorage.Contract.ClickURL(&_ShortURLStorage.TransactOpts, shortCode, e)
}

// ClickURL is a paid mutator transaction binding the contract method 0xb65384cb.
//
// Solidity: function clickURL(string shortCode, (uint256) e) returns()
func (_ShortURLStorage *ShortURLStorageTransactorSession) ClickURL(shortCode string, e ShortURLStorageClickEvent) (*types.Transaction, error) {
	return _ShortURLStorage.Contract.ClickURL(&_ShortURLStorage.TransactOpts, shortCode, e)
}

// SetURL is a paid mutator transaction binding the contract method 0x06a8c993.
//
// Solidity: function setURL(string shortCode, string longUrl) returns()
func (_ShortURLStorage *ShortURLStorageTransactor) SetURL(opts *bind.TransactOpts, shortCode string, longUrl string) (*types.Transaction, error) {
	return _ShortURLStorage.contract.Transact(opts, "setURL", shortCode, longUrl)
}

// SetURL is a paid mutator transaction binding the contract method 0x06a8c993.
//
// Solidity: function setURL(string shortCode, string longUrl) returns()
func (_ShortURLStorage *ShortURLStorageSession) SetURL(shortCode string, longUrl string) (*types.Transaction, error) {
	return _ShortURLStorage.Contract.SetURL(&_ShortURLStorage.TransactOpts, shortCode, longUrl)
}

// SetURL is a paid mutator transaction binding the contract method 0x06a8c993.
//
// Solidity: function setURL(string shortCode, string longUrl) returns()
func (_ShortURLStorage *ShortURLStorageTransactorSession) SetURL(shortCode string, longUrl string) (*types.Transaction, error) {
	return _ShortURLStorage.Contract.SetURL(&_ShortURLStorage.TransactOpts, shortCode, longUrl)
}

// ShortURLStorageURLClickedIterator is returned from FilterURLClicked and is used to iterate over the raw logs and unpacked data for URLClicked events raised by the ShortURLStorage contract.
type ShortURLStorageURLClickedIterator struct {
	Event *ShortURLStorageURLClicked // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *ShortURLStorageURLClickedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(ShortURLStorageURLClicked)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(ShortURLStorageURLClicked)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *ShortURLStorageURLClickedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *ShortURLStorageURLClickedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// ShortURLStorageURLClicked represents a URLClicked event raised by the ShortURLStorage contract.
type ShortURLStorageURLClicked struct {
	ShortCode common.Hash
	E         ShortURLStorageClickEvent
	Raw       types.Log // Blockchain specific contextual infos
}

// FilterURLClicked is a free log retrieval operation binding the contract event 0x9c7166391b271fdc923b2280a610af709b4aa0a8d1dd8f585bb4ec6becbba54d.
//
// Solidity: event URLClicked(string indexed shortCode, (uint256) e)
func (_ShortURLStorage *ShortURLStorageFilterer) FilterURLClicked(opts *bind.FilterOpts, shortCode []string) (*ShortURLStorageURLClickedIterator, error) {

	var shortCodeRule []interface{}
	for _, shortCodeItem := range shortCode {
		shortCodeRule = append(shortCodeRule, shortCodeItem)
	}

	logs, sub, err := _ShortURLStorage.contract.FilterLogs(opts, "URLClicked", shortCodeRule)
	if err != nil {
		return nil, err
	}
	return &ShortURLStorageURLClickedIterator{contract: _ShortURLStorage.contract, event: "URLClicked", logs: logs, sub: sub}, nil
}

// WatchURLClicked is a free log subscription operation binding the contract event 0x9c7166391b271fdc923b2280a610af709b4aa0a8d1dd8f585bb4ec6becbba54d.
//
// Solidity: event URLClicked(string indexed shortCode, (uint256) e)
func (_ShortURLStorage *ShortURLStorageFilterer) WatchURLClicked(opts *bind.WatchOpts, sink chan<- *ShortURLStorageURLClicked, shortCode []string) (event.Subscription, error) {

	var shortCodeRule []interface{}
	for _, shortCodeItem := range shortCode {
		shortCodeRule = append(shortCodeRule, shortCodeItem)
	}

	logs, sub, err := _ShortURLStorage.contract.WatchLogs(opts, "URLClicked", shortCodeRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(ShortURLStorageURLClicked)
				if err := _ShortURLStorage.contract.UnpackLog(event, "URLClicked", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseURLClicked is a log parse operation binding the contract event 0x9c7166391b271fdc923b2280a610af709b4aa0a8d1dd8f585bb4ec6becbba54d.
//
// Solidity: event URLClicked(string indexed shortCode, (uint256) e)
func (_ShortURLStorage *ShortURLStorageFilterer) ParseURLClicked(log types.Log) (*ShortURLStorageURLClicked, error) {
	event := new(ShortURLStorageURLClicked)
	if err := _ShortURLStorage.contract.UnpackLog(event, "URLClicked", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// ShortURLStorageURLShortenedIterator is returned from FilterURLShortened and is used to iterate over the raw logs and unpacked data for URLShortened events raised by the ShortURLStorage contract.
type ShortURLStorageURLShortenedIterator struct {
	Event *ShortURLStorageURLShortened // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *ShortURLStorageURLShortenedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(ShortURLStorageURLShortened)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(ShortURLStorageURLShortened)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *ShortURLStorageURLShortenedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *ShortURLStorageURLShortenedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// ShortURLStorageURLShortened represents a URLShortened event raised by the ShortURLStorage contract.
type ShortURLStorageURLShortened struct {
	ShortCode common.Hash
	LongUrl   string
	Raw       types.Log // Blockchain specific contextual infos
}

// FilterURLShortened is a free log retrieval operation binding the contract event 0x9fe481f7a7b06c123d956dc2c3b279940b01e54d71d3463580840d606a3db39d.
//
// Solidity: event URLShortened(string indexed shortCode, string longUrl)
func (_ShortURLStorage *ShortURLStorageFilterer) FilterURLShortened(opts *bind.FilterOpts, shortCode []string) (*ShortURLStorageURLShortenedIterator, error) {

	var shortCodeRule []interface{}
	for _, shortCodeItem := range shortCode {
		shortCodeRule = append(shortCodeRule, shortCodeItem)
	}

	logs, sub, err := _ShortURLStorage.contract.FilterLogs(opts, "URLShortened", shortCodeRule)
	if err != nil {
		return nil, err
	}
	return &ShortURLStorageURLShortenedIterator{contract: _ShortURLStorage.contract, event: "URLShortened", logs: logs, sub: sub}, nil
}

// WatchURLShortened is a free log subscription operation binding the contract event 0x9fe481f7a7b06c123d956dc2c3b279940b01e54d71d3463580840d606a3db39d.
//
// Solidity: event URLShortened(string indexed shortCode, string longUrl)
func (_ShortURLStorage *ShortURLStorageFilterer) WatchURLShortened(opts *bind.WatchOpts, sink chan<- *ShortURLStorageURLShortened, shortCode []string) (event.Subscription, error) {

	var shortCodeRule []interface{}
	for _, shortCodeItem := range shortCode {
		shortCodeRule = append(shortCodeRule, shortCodeItem)
	}

	logs, sub, err := _ShortURLStorage.contract.WatchLogs(opts, "URLShortened", shortCodeRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(ShortURLStorageURLShortened)
				if err := _ShortURLStorage.contract.UnpackLog(event, "URLShortened", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseURLShortened is a log parse operation binding the contract event 0x9fe481f7a7b06c123d956dc2c3b279940b01e54d71d3463580840d606a3db39d.
//
// Solidity: event URLShortened(string indexed shortCode, string longUrl)
func (_ShortURLStorage *ShortURLStorageFilterer) ParseURLShortened(log types.Log) (*ShortURLStorageURLShortened, error) {
	event := new(ShortURLStorageURLShortened)
	if err := _ShortURLStorage.contract.UnpackLog(event, "URLShortened", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
