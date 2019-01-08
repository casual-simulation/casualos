/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./SO4/index.ts");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./SO4/ChannelServer.ts":
/*!******************************!*\
  !*** ./SO4/ChannelServer.ts ***!
  \******************************/
/*! exports provided: ChannelServer */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ChannelServer", function() { return ChannelServer; });
/* harmony import */ var common_channels_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! common/channels-core */ "./common/channels-core/index.ts");
/* harmony import */ var _channels__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./channels */ "./SO4/channels/index.ts");
/* harmony import */ var common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! common */ "./common/index.ts");
/* harmony import */ var _channels_MongoDBConnector__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./channels/MongoDBConnector */ "./SO4/channels/MongoDBConnector.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};




var ChannelServer = /** @class */ (function () {
    function ChannelServer(config) {
        this._connector = new _channels_MongoDBConnector__WEBPACK_IMPORTED_MODULE_3__["MongoDBConnector"](config.mongodb.url, config.mongodb.dbName);
        this._client = new common_channels_core__WEBPACK_IMPORTED_MODULE_0__["ChannelClient"](this._connector, common__WEBPACK_IMPORTED_MODULE_2__["storeFactory"]);
    }
    ChannelServer.prototype.configure = function (app, socket) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._connector.init()];
                    case 1:
                        _a.sent();
                        this._server = new _channels__WEBPACK_IMPORTED_MODULE_1__["SocketIOChannelServer"](socket, this._client);
                        return [2 /*return*/];
                }
            });
        });
    };
    return ChannelServer;
}());



/***/ }),

/***/ "./SO4/channels/MongoDBConnector.ts":
/*!******************************************!*\
  !*** ./SO4/channels/MongoDBConnector.ts ***!
  \******************************************/
/*! exports provided: MongoDBConnector */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MongoDBConnector", function() { return MongoDBConnector; });
/* harmony import */ var mongodb__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mongodb */ "mongodb");
/* harmony import */ var mongodb__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mongodb__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var pify__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! pify */ "pify");
/* harmony import */ var pify__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(pify__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var common_channels_core__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! common/channels-core */ "./common/channels-core/index.ts");
var __extends = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};



var connect = pify__WEBPACK_IMPORTED_MODULE_1__(mongodb__WEBPACK_IMPORTED_MODULE_0__["MongoClient"].connect);
/**
 * Defines a channel connector which is able to pipe events to MongoDB for storage and load initial events from MongoDB.
 */
var MongoDBConnector = /** @class */ (function (_super) {
    __extends(MongoDBConnector, _super);
    function MongoDBConnector(uri, dbName) {
        var _this = _super.call(this) || this;
        _this._collectionName = 'channels';
        _this._uri = uri;
        _this._dbName = dbName;
        return _this;
    }
    MongoDBConnector.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this;
                        return [4 /*yield*/, connect(this._uri)];
                    case 1:
                        _a._client = _b.sent();
                        this._db = this._client.db(this._dbName);
                        this._collection = this._db.collection(this._collectionName);
                        return [2 /*return*/];
                }
            });
        });
    };
    MongoDBConnector.prototype._initConnection = function (request, helper) {
        return __awaiter(this, void 0, void 0, function () {
            var storage;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _super.prototype._initConnection.call(this, request, helper)];
                    case 1:
                        _a.sent();
                        console.log("[MongoDBConnector] Initializing new channel " + request.info.id + ". Grabbing initial state...");
                        return [4 /*yield*/, this._collection.findOne({ channel: request.info.id })];
                    case 2:
                        storage = _a.sent();
                        if (storage) {
                            console.log('[MongoDBConnector] Using initial state:', storage.state);
                            request.store.init(storage.state);
                        }
                        else {
                            console.log('[MongoDBConnector] No initial state.');
                        }
                        helper.setEmitToStoreFunction(function (event) {
                            request.store.process(event);
                            var state = request.store.state();
                            _this._collection.updateOne({ channel: request.info.id }, {
                                $set: {
                                    channel: request.info.id,
                                    state: state
                                }
                            }, {
                                upsert: true
                            });
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    return MongoDBConnector;
}(common_channels_core__WEBPACK_IMPORTED_MODULE_2__["MemoryConnector"]));



/***/ }),

/***/ "./SO4/channels/SocketIOChannelServer.ts":
/*!***********************************************!*\
  !*** ./SO4/channels/SocketIOChannelServer.ts ***!
  \***********************************************/
/*! exports provided: SocketIOChannelServer */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "SocketIOChannelServer", function() { return SocketIOChannelServer; });
/**
 * Defines a class which acts as a server for SocketIO channels such that
 * any ChannelClient (whether running on the server or on a client) which uses a SocketIOChannelConnector
 * is able to connect to channels.
 */
var SocketIOChannelServer = /** @class */ (function () {
    function SocketIOChannelServer(server, client) {
        var _this = this;
        this._serverList = {};
        this._client = client;
        this._server = server;
        this._userCount = 0;
        this._server.on('connection', function (socket) {
            _this._userCount += 1;
            console.log('[SocketIOChannelServer] A user connected! There are now', _this._userCount, 'users connected.');
            socket.on('join_server', function (info, callback) {
                console.log('[SocketIOChannelServer] Joining user to server', info.id);
                socket.join(info.id, function (err) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    _this._client.getChannel(info).subscribe().then(function (connection) {
                        if (!_this._serverList[info.id]) {
                            _this._serverList[info.id] = connection;
                        }
                        var eventName = "new_event_" + info.id;
                        var listener = function (event) {
                            connection.emit(event);
                            socket.to(info.id).emit(eventName, event);
                        };
                        socket.on(eventName, listener);
                        socket.on('leave_server', function (id, callback) {
                            if (id === info.id) {
                                connection.unsubscribe();
                                socket.off(eventName, listener);
                            }
                            callback(null);
                        });
                        callback(null, connection.info, connection.store.state());
                    }, function (err) {
                        callback(err);
                    });
                });
            });
            socket.on('disconnect', function () {
                _this._userCount -= 1;
                console.log('[SocketIOChannelServer] A user disconnected! There are now', _this._userCount, 'users connected.');
            });
        });
    }
    return SocketIOChannelServer;
}());



/***/ }),

/***/ "./SO4/channels/index.ts":
/*!*******************************!*\
  !*** ./SO4/channels/index.ts ***!
  \*******************************/
/*! exports provided: SocketIOChannelServer */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _SocketIOChannelServer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./SocketIOChannelServer */ "./SO4/channels/SocketIOChannelServer.ts");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "SocketIOChannelServer", function() { return _SocketIOChannelServer__WEBPACK_IMPORTED_MODULE_0__["SocketIOChannelServer"]; });




/***/ }),

/***/ "./SO4/index.ts":
/*!**********************!*\
  !*** ./SO4/index.ts ***!
  \**********************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./server */ "./SO4/server.ts");
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! path */ "path");
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_1__);
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};


var config = {
    socket: {
        pingInterval: 2000,
        pingTimeout: 10000,
    },
    socketPort: 4567,
    httpPort: 3000,
    client: {
        dist: path__WEBPACK_IMPORTED_MODULE_1__["resolve"](__dirname, '..', '..', 'WebClient', 'dist')
    },
    channels: {
        mongodb: {
            url: 'mongodb://db-04.1.back-end.io:27017',
            dbName: 'SO4'
        }
    }
};
var server = new _server__WEBPACK_IMPORTED_MODULE_0__["Server"](config);
function init() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, server.configure()];
                case 1:
                    _a.sent();
                    server.start();
                    return [2 /*return*/];
            }
        });
    });
}
init();


/***/ }),

/***/ "./SO4/server.ts":
/*!***********************!*\
  !*** ./SO4/server.ts ***!
  \***********************/
/*! exports provided: Server */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Server", function() { return Server; });
/* harmony import */ var http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! http */ "http");
/* harmony import */ var http__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(http__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var express__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! express */ "express");
/* harmony import */ var express__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(express__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var body_parser__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! body-parser */ "body-parser");
/* harmony import */ var body_parser__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(body_parser__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var socket_io__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! socket.io */ "socket.io");
/* harmony import */ var socket_io__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(socket_io__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _ChannelServer__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./ChannelServer */ "./SO4/ChannelServer.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./utils */ "./SO4/utils.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};






;
/**
 * Defines a class that represents a fully featured SO4 server.
 */
var Server = /** @class */ (function () {
    function Server(config) {
        this._config = config;
        this._app = express__WEBPACK_IMPORTED_MODULE_1__();
        this._http = new http__WEBPACK_IMPORTED_MODULE_0__["Server"](this._app);
        this._socket = socket_io__WEBPACK_IMPORTED_MODULE_3__(this._http, config.socket);
        this._channelServer = new _ChannelServer__WEBPACK_IMPORTED_MODULE_4__["ChannelServer"](config.channels);
    }
    Server.prototype.configure = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._app.use(body_parser__WEBPACK_IMPORTED_MODULE_2__["json"]());
                        return [4 /*yield*/, this._channelServer.configure(this._app, this._socket)];
                    case 1:
                        _a.sent();
                        this._app.use('/', express__WEBPACK_IMPORTED_MODULE_1__["static"](this._config.client.dist));
                        this._app.post('/api/users', Object(_utils__WEBPACK_IMPORTED_MODULE_5__["asyncMiddleware"])(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                            var json, username;
                            return __generator(this, function (_a) {
                                json = req.body;
                                username = json.email.split('@')[0];
                                // TODO: Do something like actual user login
                                res.send({
                                    email: json.email,
                                    username: username,
                                    name: username
                                });
                                return [2 /*return*/];
                            });
                        }); }));
                        return [2 /*return*/];
                }
            });
        });
    };
    Server.prototype.start = function () {
        var _this = this;
        this._http.listen(this._config.httpPort, function () { return console.log("Example app listening on port " + _this._config.httpPort + "!"); });
    };
    return Server;
}());

;


/***/ }),

/***/ "./SO4/utils.ts":
/*!**********************!*\
  !*** ./SO4/utils.ts ***!
  \**********************/
/*! exports provided: asyncMiddleware */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "asyncMiddleware", function() { return asyncMiddleware; });
var asyncMiddleware = function (fn) {
    return function (req, res, next) {
        Promise.resolve(fn(req, res, next))
            .catch(function (er) {
            var err = er;
            if (err.response && err.response.data) {
                console.error('An Axios request failed.', err, err.response.data);
            }
            next(er);
        });
    };
};


/***/ }),

/***/ "./common/FilesChannel.ts":
/*!********************************!*\
  !*** ./common/FilesChannel.ts ***!
  \********************************/
/*! exports provided: filesReducer, FilesStateStore, fileAdded, fileRemoved, fileUpdated */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "filesReducer", function() { return filesReducer; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "FilesStateStore", function() { return FilesStateStore; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fileAdded", function() { return fileAdded; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fileRemoved", function() { return fileRemoved; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fileUpdated", function() { return fileUpdated; });
/* harmony import */ var _channels_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./channels-core */ "./common/channels-core/index.ts");
/* harmony import */ var lodash__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash */ "lodash");
/* harmony import */ var lodash__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash__WEBPACK_IMPORTED_MODULE_1__);
var __extends = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __rest = (undefined && undefined.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};


function filesReducer(state, event) {
    var _a, _b;
    state = state || {};
    if (event.type === 'file_added') {
        return Object(lodash__WEBPACK_IMPORTED_MODULE_1__["merge"])({}, state, (_a = {},
            _a[event.id] = event.file,
            _a));
    }
    else if (event.type === 'file_removed') {
        var _c = event.id, removed = state[_c], others = __rest(state, [typeof _c === "symbol" ? _c : _c + ""]);
        return others;
    }
    else if (event.type === 'file_updated') {
        var newData = Object(lodash__WEBPACK_IMPORTED_MODULE_1__["merge"])({}, state, (_b = {},
            _b[event.id] = event.update,
            _b));
        for (var property in newData[event.id].tags) {
            var value = newData[event.id].tags[property];
            if (value === null) {
                delete newData[event.id].tags[property];
            }
        }
        return newData;
    }
    return state;
}
var FilesStateStore = /** @class */ (function (_super) {
    __extends(FilesStateStore, _super);
    function FilesStateStore(defaultState) {
        return _super.call(this, defaultState, filesReducer) || this;
    }
    return FilesStateStore;
}(_channels_core__WEBPACK_IMPORTED_MODULE_0__["ReducingStateStore"]));

function fileAdded(file) {
    return {
        type: 'file_added',
        id: file.id,
        file: file,
        creation_time: new Date()
    };
}
function fileRemoved(file) {
    return {
        type: 'file_removed',
        id: file.id,
        creation_time: new Date()
    };
}
function fileUpdated(id, update) {
    return {
        type: 'file_updated',
        id: id,
        update: update,
        creation_time: new Date()
    };
}


/***/ }),

/***/ "./common/channels-core/Channel.ts":
/*!*****************************************!*\
  !*** ./common/channels-core/Channel.ts ***!
  \*****************************************/
/*! exports provided: Channel */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Channel", function() { return Channel; });
/**
 * Default implementation of IChannel.
 */
var Channel = /** @class */ (function () {
    /**
     * Creates a new Channel which uses the given services.
     * @param info The information about the channel.
     * @param connector A service which can connect a channel to a network. (WebSockets, Bluetooth, etc.)
     * @param store A service manages the state for this channel.
     */
    function Channel(info, connector, store) {
        this._info = info;
        this._connector = connector;
        this._store = store;
    }
    Channel.prototype.id = function () {
        return this._info.id;
    };
    Channel.prototype.subscribe = function () {
        return this._connector.connectToChannel({
            info: this.info(),
            store: this._store
        });
    };
    Channel.prototype.info = function () {
        return this._info;
    };
    return Channel;
}());



/***/ }),

/***/ "./common/channels-core/ChannelClient.ts":
/*!***********************************************!*\
  !*** ./common/channels-core/ChannelClient.ts ***!
  \***********************************************/
/*! exports provided: ChannelClient */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ChannelClient", function() { return ChannelClient; });
/* harmony import */ var _Channel__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Channel */ "./common/channels-core/Channel.ts");
/* harmony import */ var _builtin_DiscoveryChannel__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./builtin/DiscoveryChannel */ "./common/channels-core/builtin/DiscoveryChannel.ts");


/**
 * Defines a default implementation of a channel client.
 */
var ChannelClient = /** @class */ (function () {
    function ChannelClient(connector, storeFactory) {
        this._connector = connector;
        this._storeFactory = storeFactory;
        this._discovery_channel = this.getChannelWithStore(_builtin_DiscoveryChannel__WEBPACK_IMPORTED_MODULE_1__["DiscoveryChannelInfo"], Object(_builtin_DiscoveryChannel__WEBPACK_IMPORTED_MODULE_1__["createDiscoveryChannelStateStore"])());
    }
    ChannelClient.prototype.discoveryChannel = function () {
        return this._discovery_channel;
    };
    ChannelClient.prototype.getChannel = function (info) {
        return this.getChannelWithStore(info, this._storeFactory.create(info));
    };
    ChannelClient.prototype.getChannelWithStore = function (info, store) {
        return new _Channel__WEBPACK_IMPORTED_MODULE_0__["Channel"](info, this._connector, store);
    };
    return ChannelClient;
}());



/***/ }),

/***/ "./common/channels-core/StateStore.ts":
/*!********************************************!*\
  !*** ./common/channels-core/StateStore.ts ***!
  \********************************************/
/*! exports provided: ReducingStateStore */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ReducingStateStore", function() { return ReducingStateStore; });
/**
 * Defines a state store that uses a special function called a reducer to incorporate
 * new events into the state.
 */
var ReducingStateStore = /** @class */ (function () {
    function ReducingStateStore(defaultState, reducer) {
        this._state = defaultState;
        this._reducer = reducer;
    }
    ReducingStateStore.prototype.state = function () {
        return this._state;
    };
    ReducingStateStore.prototype.process = function (event) {
        this._state = this._reducer(this._state, event);
    };
    ReducingStateStore.prototype.init = function (state) {
        if (typeof state !== 'undefined') {
            this._state = state;
        }
    };
    return ReducingStateStore;
}());



/***/ }),

/***/ "./common/channels-core/builtin/BaseConnector.ts":
/*!*******************************************************!*\
  !*** ./common/channels-core/builtin/BaseConnector.ts ***!
  \*******************************************************/
/*! exports provided: BaseConnector */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "BaseConnector", function() { return BaseConnector; });
/* harmony import */ var rxjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! rxjs */ "rxjs");
/* harmony import */ var rxjs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(rxjs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var rxjs_operators__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! rxjs/operators */ "rxjs/operators");
/* harmony import */ var rxjs_operators__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(rxjs_operators__WEBPACK_IMPORTED_MODULE_1__);


/**
 * Defines a base class for connectors.
 * This class helps create channel connections which behave correctly.
 */
var BaseConnector = /** @class */ (function () {
    function BaseConnector() {
    }
    BaseConnector.prototype.connectToChannel = function (connection_request) {
        throw new Error('Not implemented.');
    };
    /**
     * Creates a new channel connection which pipes events to the correct locations.
     * In particular, events emitted locally are sent to the server while events emitted from the server
     * are send locally. See emitToServer and emitFromServer.
     * @param connection_request
     */
    BaseConnector.prototype.newConnection = function (connection_request) {
        var subject = new rxjs__WEBPACK_IMPORTED_MODULE_0__["Subject"]();
        var info = connection_request.info;
        var store = connection_request.store;
        var serverEvents;
        var onUnsubscribe = new rxjs__WEBPACK_IMPORTED_MODULE_0__["Subject"]();
        var emitToServer;
        var emitToStore;
        var build = function () {
            var subs = [];
            if (serverEvents) {
                // Pipe the server events into the subject.
                subs.push(serverEvents.pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_1__["map"])(function (e) { return ({
                    event: e,
                    isLocal: false
                }); })).subscribe(subject));
            }
            if (emitToServer != null) {
                subs.push(subject.pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_1__["filter"])(function (e) { return e.isLocal; }), Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_1__["map"])(function (e) { return e.event; }), Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_1__["tap"])(function (e) { return emitToServer(e); })).subscribe());
            }
            if (!emitToStore) {
                emitToStore = function (e) {
                    store.process(e);
                };
            }
            subs.push(subject.pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_1__["map"])(function (e) { return e.event; }), Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_1__["tap"])(emitToStore)).subscribe());
            return {
                emit: function (event) {
                    subject.next({
                        event: event,
                        isLocal: true
                    });
                },
                events: subject.pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_1__["map"])(function (e) { return e.event; })),
                store: connection_request.store,
                info: connection_request.info,
                unsubscribe: function () {
                    subs.forEach(function (s) { return s.unsubscribe(); });
                    subject.complete();
                    subject.unsubscribe();
                    onUnsubscribe.next({});
                    onUnsubscribe.complete();
                }
            };
        };
        var helper = {
            build: build,
            setServerEvents: function (events) {
                serverEvents = events;
            },
            setEmitToServerFunction: function (fn) {
                emitToServer = fn;
            },
            setEmitToStoreFunction: function (fn) {
                emitToStore = fn;
            },
            onUnsubscribe: onUnsubscribe.pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_1__["first"])())
        };
        return helper;
    };
    return BaseConnector;
}());



/***/ }),

/***/ "./common/channels-core/builtin/DiscoveryChannel.ts":
/*!**********************************************************!*\
  !*** ./common/channels-core/builtin/DiscoveryChannel.ts ***!
  \**********************************************************/
/*! exports provided: discoveryChannelReducer, createDiscoveryChannelStateStore, DiscoveryChannelInfo, channelCreated, channelRemoved */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "discoveryChannelReducer", function() { return discoveryChannelReducer; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createDiscoveryChannelStateStore", function() { return createDiscoveryChannelStateStore; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "DiscoveryChannelInfo", function() { return DiscoveryChannelInfo; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "channelCreated", function() { return channelCreated; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "channelRemoved", function() { return channelRemoved; });
/* harmony import */ var lodash__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash */ "lodash");
/* harmony import */ var lodash__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _StateStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../StateStore */ "./common/channels-core/StateStore.ts");


/**
 * A function that is able to apply discovery events to the channel state.
 * @param state The current state.
 * @param event The event that should be added to the state.
 */
function discoveryChannelReducer(state, event) {
    state = state || [];
    if (event.type === 'channel_removed') {
        Object(lodash__WEBPACK_IMPORTED_MODULE_0__["remove"])(state, function (s) { return s.id === event.channel_id; });
    }
    else if (event.type === 'channel_created') {
        state.push(event.info);
    }
    return state;
}
/**
 * Constructs a new state store that should be used with discovery channels.
 */
function createDiscoveryChannelStateStore() {
    return new _StateStore__WEBPACK_IMPORTED_MODULE_1__["ReducingStateStore"]([], discoveryChannelReducer);
}
/**
 * Info about the discovery channel.
 */
var DiscoveryChannelInfo = {
    type: 'discovery_channel',
    id: 'discovery_channel',
    name: 'Channel for discovering other channels.'
};
/**
 * Creates a new channel created event.
 * @param info The info for the channel that was created.
 */
function channelCreated(info) {
    return {
        type: 'channel_created',
        creation_time: new Date(),
        info: info
    };
}
/**
 * Creates a new channel removed event.
 * @param info The info for the channel that was created.
 */
function channelRemoved(channel_id) {
    return {
        type: 'channel_removed',
        creation_time: new Date(),
        channel_id: channel_id
    };
}


/***/ }),

/***/ "./common/channels-core/builtin/MemoryConnector.ts":
/*!*********************************************************!*\
  !*** ./common/channels-core/builtin/MemoryConnector.ts ***!
  \*********************************************************/
/*! exports provided: MemoryConnector */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MemoryConnector", function() { return MemoryConnector; });
/* harmony import */ var _BaseConnector__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./BaseConnector */ "./common/channels-core/builtin/BaseConnector.ts");
var __extends = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};

/**
 * Defines a channel connector which is able to pipe events through memory to other channels.
 * Sometimes useful for servers.
 */
var MemoryConnector = /** @class */ (function (_super) {
    __extends(MemoryConnector, _super);
    function MemoryConnector() {
        var _this = _super.call(this) || this;
        _this._channels = {};
        return _this;
    }
    MemoryConnector.prototype.connectToChannel = function (connection_request) {
        if (this._channels[connection_request.info.id]) {
            return Promise.resolve(this._channels[connection_request.info.id]);
        }
        else {
            return this._createNewConnection(connection_request);
        }
    };
    MemoryConnector.prototype._createNewConnection = function (connection_request) {
        return __awaiter(this, void 0, void 0, function () {
            var helper, connection;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        helper = this.newConnection(connection_request);
                        return [4 /*yield*/, this._initConnection(connection_request, helper)];
                    case 1:
                        _a.sent();
                        connection = helper.build();
                        this._channels[connection_request.info.id] = connection;
                        return [2 /*return*/, connection];
                }
            });
        });
    };
    MemoryConnector.prototype._initConnection = function (request, helper) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        });
    };
    return MemoryConnector;
}(_BaseConnector__WEBPACK_IMPORTED_MODULE_0__["BaseConnector"]));



/***/ }),

/***/ "./common/channels-core/builtin/StoreFactory.ts":
/*!******************************************************!*\
  !*** ./common/channels-core/builtin/StoreFactory.ts ***!
  \******************************************************/
/*! exports provided: StoreFactory */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "StoreFactory", function() { return StoreFactory; });
/**
 * Defines a class which provides a default implementation of a StateStoreFactory.
 */
var StoreFactory = /** @class */ (function () {
    function StoreFactory(map) {
        this._map = map || {};
    }
    StoreFactory.prototype.create = function (info) {
        var factory = this._map[info.type];
        if (factory) {
            return factory();
        }
        else {
            throw new Error('Unable to create a factory for channel of type: "' + info.type + '. No corresponding function exists in the map.');
        }
    };
    return StoreFactory;
}());



/***/ }),

/***/ "./common/channels-core/builtin/index.ts":
/*!***********************************************!*\
  !*** ./common/channels-core/builtin/index.ts ***!
  \***********************************************/
/*! exports provided: BaseConnector, MemoryConnector, discoveryChannelReducer, createDiscoveryChannelStateStore, DiscoveryChannelInfo, channelCreated, channelRemoved, StoreFactory */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _BaseConnector__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./BaseConnector */ "./common/channels-core/builtin/BaseConnector.ts");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "BaseConnector", function() { return _BaseConnector__WEBPACK_IMPORTED_MODULE_0__["BaseConnector"]; });

/* harmony import */ var _MemoryConnector__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./MemoryConnector */ "./common/channels-core/builtin/MemoryConnector.ts");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MemoryConnector", function() { return _MemoryConnector__WEBPACK_IMPORTED_MODULE_1__["MemoryConnector"]; });

/* harmony import */ var _DiscoveryChannel__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./DiscoveryChannel */ "./common/channels-core/builtin/DiscoveryChannel.ts");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "discoveryChannelReducer", function() { return _DiscoveryChannel__WEBPACK_IMPORTED_MODULE_2__["discoveryChannelReducer"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "createDiscoveryChannelStateStore", function() { return _DiscoveryChannel__WEBPACK_IMPORTED_MODULE_2__["createDiscoveryChannelStateStore"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "DiscoveryChannelInfo", function() { return _DiscoveryChannel__WEBPACK_IMPORTED_MODULE_2__["DiscoveryChannelInfo"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "channelCreated", function() { return _DiscoveryChannel__WEBPACK_IMPORTED_MODULE_2__["channelCreated"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "channelRemoved", function() { return _DiscoveryChannel__WEBPACK_IMPORTED_MODULE_2__["channelRemoved"]; });

/* harmony import */ var _StoreFactory__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./StoreFactory */ "./common/channels-core/builtin/StoreFactory.ts");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "StoreFactory", function() { return _StoreFactory__WEBPACK_IMPORTED_MODULE_3__["StoreFactory"]; });







/***/ }),

/***/ "./common/channels-core/index.ts":
/*!***************************************!*\
  !*** ./common/channels-core/index.ts ***!
  \***************************************/
/*! exports provided: Channel, ChannelClient, ReducingStateStore, BaseConnector, MemoryConnector, discoveryChannelReducer, createDiscoveryChannelStateStore, DiscoveryChannelInfo, channelCreated, channelRemoved, StoreFactory */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _Channel__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Channel */ "./common/channels-core/Channel.ts");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "Channel", function() { return _Channel__WEBPACK_IMPORTED_MODULE_0__["Channel"]; });

/* harmony import */ var _ChannelClient__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./ChannelClient */ "./common/channels-core/ChannelClient.ts");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "ChannelClient", function() { return _ChannelClient__WEBPACK_IMPORTED_MODULE_1__["ChannelClient"]; });

/* harmony import */ var _StateStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./StateStore */ "./common/channels-core/StateStore.ts");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "ReducingStateStore", function() { return _StateStore__WEBPACK_IMPORTED_MODULE_2__["ReducingStateStore"]; });

/* harmony import */ var _builtin__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./builtin */ "./common/channels-core/builtin/index.ts");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "BaseConnector", function() { return _builtin__WEBPACK_IMPORTED_MODULE_3__["BaseConnector"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MemoryConnector", function() { return _builtin__WEBPACK_IMPORTED_MODULE_3__["MemoryConnector"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "discoveryChannelReducer", function() { return _builtin__WEBPACK_IMPORTED_MODULE_3__["discoveryChannelReducer"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "createDiscoveryChannelStateStore", function() { return _builtin__WEBPACK_IMPORTED_MODULE_3__["createDiscoveryChannelStateStore"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "DiscoveryChannelInfo", function() { return _builtin__WEBPACK_IMPORTED_MODULE_3__["DiscoveryChannelInfo"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "channelCreated", function() { return _builtin__WEBPACK_IMPORTED_MODULE_3__["channelCreated"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "channelRemoved", function() { return _builtin__WEBPACK_IMPORTED_MODULE_3__["channelRemoved"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "StoreFactory", function() { return _builtin__WEBPACK_IMPORTED_MODULE_3__["StoreFactory"]; });







/***/ }),

/***/ "./common/index.ts":
/*!*************************!*\
  !*** ./common/index.ts ***!
  \*************************/
/*! exports provided: storeFactory, channelTypes, filesReducer, FilesStateStore, fileAdded, fileRemoved, fileUpdated */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "storeFactory", function() { return storeFactory; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "channelTypes", function() { return channelTypes; });
/* harmony import */ var _channels_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./channels-core */ "./common/channels-core/index.ts");
/* harmony import */ var _FilesChannel__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./FilesChannel */ "./common/FilesChannel.ts");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "filesReducer", function() { return _FilesChannel__WEBPACK_IMPORTED_MODULE_1__["filesReducer"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "FilesStateStore", function() { return _FilesChannel__WEBPACK_IMPORTED_MODULE_1__["FilesStateStore"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "fileAdded", function() { return _FilesChannel__WEBPACK_IMPORTED_MODULE_1__["fileAdded"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "fileRemoved", function() { return _FilesChannel__WEBPACK_IMPORTED_MODULE_1__["fileRemoved"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "fileUpdated", function() { return _FilesChannel__WEBPACK_IMPORTED_MODULE_1__["fileUpdated"]; });




var storeFactory = new _channels_core__WEBPACK_IMPORTED_MODULE_0__["StoreFactory"]({
    files: function () { return new _FilesChannel__WEBPACK_IMPORTED_MODULE_1__["FilesStateStore"]({}); }
});
var channelTypes = {
    files: 'files'
};


/***/ }),

/***/ "body-parser":
/*!******************************!*\
  !*** external "body-parser" ***!
  \******************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("body-parser");

/***/ }),

/***/ "express":
/*!**************************!*\
  !*** external "express" ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("express");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("http");

/***/ }),

/***/ "lodash":
/*!*************************!*\
  !*** external "lodash" ***!
  \*************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("lodash");

/***/ }),

/***/ "mongodb":
/*!**************************!*\
  !*** external "mongodb" ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("mongodb");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("path");

/***/ }),

/***/ "pify":
/*!***********************!*\
  !*** external "pify" ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("pify");

/***/ }),

/***/ "rxjs":
/*!***********************!*\
  !*** external "rxjs" ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("rxjs");

/***/ }),

/***/ "rxjs/operators":
/*!*********************************!*\
  !*** external "rxjs/operators" ***!
  \*********************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("rxjs/operators");

/***/ }),

/***/ "socket.io":
/*!****************************!*\
  !*** external "socket.io" ***!
  \****************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("socket.io");

/***/ })

/******/ });
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vLy4vU080L0NoYW5uZWxTZXJ2ZXIudHMiLCJ3ZWJwYWNrOi8vLy4vU080L2NoYW5uZWxzL01vbmdvREJDb25uZWN0b3IudHMiLCJ3ZWJwYWNrOi8vLy4vU080L2NoYW5uZWxzL1NvY2tldElPQ2hhbm5lbFNlcnZlci50cyIsIndlYnBhY2s6Ly8vLi9TTzQvY2hhbm5lbHMvaW5kZXgudHMiLCJ3ZWJwYWNrOi8vLy4vU080L2luZGV4LnRzIiwid2VicGFjazovLy8uL1NPNC9zZXJ2ZXIudHMiLCJ3ZWJwYWNrOi8vLy4vU080L3V0aWxzLnRzIiwid2VicGFjazovLy8uL2NvbW1vbi9GaWxlc0NoYW5uZWwudHMiLCJ3ZWJwYWNrOi8vLy4vY29tbW9uL2NoYW5uZWxzLWNvcmUvQ2hhbm5lbC50cyIsIndlYnBhY2s6Ly8vLi9jb21tb24vY2hhbm5lbHMtY29yZS9DaGFubmVsQ2xpZW50LnRzIiwid2VicGFjazovLy8uL2NvbW1vbi9jaGFubmVscy1jb3JlL1N0YXRlU3RvcmUudHMiLCJ3ZWJwYWNrOi8vLy4vY29tbW9uL2NoYW5uZWxzLWNvcmUvYnVpbHRpbi9CYXNlQ29ubmVjdG9yLnRzIiwid2VicGFjazovLy8uL2NvbW1vbi9jaGFubmVscy1jb3JlL2J1aWx0aW4vRGlzY292ZXJ5Q2hhbm5lbC50cyIsIndlYnBhY2s6Ly8vLi9jb21tb24vY2hhbm5lbHMtY29yZS9idWlsdGluL01lbW9yeUNvbm5lY3Rvci50cyIsIndlYnBhY2s6Ly8vLi9jb21tb24vY2hhbm5lbHMtY29yZS9idWlsdGluL1N0b3JlRmFjdG9yeS50cyIsIndlYnBhY2s6Ly8vLi9jb21tb24vY2hhbm5lbHMtY29yZS9idWlsdGluL2luZGV4LnRzIiwid2VicGFjazovLy8uL2NvbW1vbi9jaGFubmVscy1jb3JlL2luZGV4LnRzIiwid2VicGFjazovLy8uL2NvbW1vbi9pbmRleC50cyIsIndlYnBhY2s6Ly8vZXh0ZXJuYWwgXCJib2R5LXBhcnNlclwiIiwid2VicGFjazovLy9leHRlcm5hbCBcImV4cHJlc3NcIiIsIndlYnBhY2s6Ly8vZXh0ZXJuYWwgXCJodHRwXCIiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwibG9kYXNoXCIiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwibW9uZ29kYlwiIiwid2VicGFjazovLy9leHRlcm5hbCBcInBhdGhcIiIsIndlYnBhY2s6Ly8vZXh0ZXJuYWwgXCJwaWZ5XCIiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwicnhqc1wiIiwid2VicGFjazovLy9leHRlcm5hbCBcInJ4anMvb3BlcmF0b3JzXCIiLCJ3ZWJwYWNrOi8vL2V4dGVybmFsIFwic29ja2V0LmlvXCIiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0Esa0RBQTBDLGdDQUFnQztBQUMxRTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLGdFQUF3RCxrQkFBa0I7QUFDMUU7QUFDQSx5REFBaUQsY0FBYztBQUMvRDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaURBQXlDLGlDQUFpQztBQUMxRSx3SEFBZ0gsbUJBQW1CLEVBQUU7QUFDckk7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxtQ0FBMkIsMEJBQTBCLEVBQUU7QUFDdkQseUNBQWlDLGVBQWU7QUFDaEQ7QUFDQTtBQUNBOztBQUVBO0FBQ0EsOERBQXNELCtEQUErRDs7QUFFckg7QUFDQTs7O0FBR0E7QUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDakZpSTtBQUM5RTtBQUVnQjtBQUNKO0FB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QUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQWdDO0FBQ0U7QUFDQztBQUNKOzs7Ozs7Ozs7Ozs7O0FDQS9CO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUEwQjtBQUNNO0FBRUg7QUFDSDs7Ozs7Ozs7Ozs7OztBQ1AxQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBK0M7QUFDRTtBQUdsQjtBQUV4QixJQUFNLFlBQVksR0FBRyxJQUFJLDJEQUFZLENBQUM7SUFDekMsS0FBSyxFQUFFLGNBQU0sV0FBSSw2REFBZSxDQUFDLEVBQUUsQ0FBQyxFQUF2QixDQUF1QjtDQUN2QyxDQUFDLENBQUM7QUFFSSxJQUFNLFlBQVksR0FBRztJQUN4QixLQUFLLEVBQUUsT0FBTztDQUNqQixDQUFDOzs7Ozs7Ozs7Ozs7QUNaRix3Qzs7Ozs7Ozs7Ozs7QUNBQSxvQzs7Ozs7Ozs7Ozs7QUNBQSxpQzs7Ozs7Ozs7Ozs7QUNBQSxtQzs7Ozs7Ozs7Ozs7QUNBQSxvQzs7Ozs7Ozs7Ozs7QUNBQSxpQzs7Ozs7Ozs7Ozs7QUNBQSxpQzs7Ozs7Ozs7Ozs7QUNBQSxpQzs7Ozs7Ozs7Ozs7QUNBQSwyQzs7Ozs7Ozs7Ozs7QUNBQSxzQyIsImZpbGUiOiJtYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiIFx0Ly8gVGhlIG1vZHVsZSBjYWNoZVxuIFx0dmFyIGluc3RhbGxlZE1vZHVsZXMgPSB7fTtcblxuIFx0Ly8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbiBcdGZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblxuIFx0XHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcbiBcdFx0aWYoaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0pIHtcbiBcdFx0XHRyZXR1cm4gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0uZXhwb3J0cztcbiBcdFx0fVxuIFx0XHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuIFx0XHR2YXIgbW9kdWxlID0gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0gPSB7XG4gXHRcdFx0aTogbW9kdWxlSWQsXG4gXHRcdFx0bDogZmFsc2UsXG4gXHRcdFx0ZXhwb3J0czoge31cbiBcdFx0fTtcblxuIFx0XHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cbiBcdFx0bW9kdWxlc1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cbiBcdFx0Ly8gRmxhZyB0aGUgbW9kdWxlIGFzIGxvYWRlZFxuIFx0XHRtb2R1bGUubCA9IHRydWU7XG5cbiBcdFx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcbiBcdFx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xuIFx0fVxuXG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlcyBvYmplY3QgKF9fd2VicGFja19tb2R1bGVzX18pXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm0gPSBtb2R1bGVzO1xuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZSBjYWNoZVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5jID0gaW5zdGFsbGVkTW9kdWxlcztcblxuIFx0Ly8gZGVmaW5lIGdldHRlciBmdW5jdGlvbiBmb3IgaGFybW9ueSBleHBvcnRzXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSBmdW5jdGlvbihleHBvcnRzLCBuYW1lLCBnZXR0ZXIpIHtcbiBcdFx0aWYoIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBuYW1lKSkge1xuIFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBuYW1lLCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZ2V0dGVyIH0pO1xuIFx0XHR9XG4gXHR9O1xuXG4gXHQvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSBmdW5jdGlvbihleHBvcnRzKSB7XG4gXHRcdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuIFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuIFx0XHR9XG4gXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG4gXHR9O1xuXG4gXHQvLyBjcmVhdGUgYSBmYWtlIG5hbWVzcGFjZSBvYmplY3RcbiBcdC8vIG1vZGUgJiAxOiB2YWx1ZSBpcyBhIG1vZHVsZSBpZCwgcmVxdWlyZSBpdFxuIFx0Ly8gbW9kZSAmIDI6IG1lcmdlIGFsbCBwcm9wZXJ0aWVzIG9mIHZhbHVlIGludG8gdGhlIG5zXG4gXHQvLyBtb2RlICYgNDogcmV0dXJuIHZhbHVlIHdoZW4gYWxyZWFkeSBucyBvYmplY3RcbiBcdC8vIG1vZGUgJiA4fDE6IGJlaGF2ZSBsaWtlIHJlcXVpcmVcbiBcdF9fd2VicGFja19yZXF1aXJlX18udCA9IGZ1bmN0aW9uKHZhbHVlLCBtb2RlKSB7XG4gXHRcdGlmKG1vZGUgJiAxKSB2YWx1ZSA9IF9fd2VicGFja19yZXF1aXJlX18odmFsdWUpO1xuIFx0XHRpZihtb2RlICYgOCkgcmV0dXJuIHZhbHVlO1xuIFx0XHRpZigobW9kZSAmIDQpICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgJiYgdmFsdWUuX19lc01vZHVsZSkgcmV0dXJuIHZhbHVlO1xuIFx0XHR2YXIgbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuIFx0XHRfX3dlYnBhY2tfcmVxdWlyZV9fLnIobnMpO1xuIFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkobnMsICdkZWZhdWx0JywgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdmFsdWUgfSk7XG4gXHRcdGlmKG1vZGUgJiAyICYmIHR5cGVvZiB2YWx1ZSAhPSAnc3RyaW5nJykgZm9yKHZhciBrZXkgaW4gdmFsdWUpIF9fd2VicGFja19yZXF1aXJlX18uZChucywga2V5LCBmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHZhbHVlW2tleV07IH0uYmluZChudWxsLCBrZXkpKTtcbiBcdFx0cmV0dXJuIG5zO1xuIFx0fTtcblxuIFx0Ly8gZ2V0RGVmYXVsdEV4cG9ydCBmdW5jdGlvbiBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIG5vbi1oYXJtb255IG1vZHVsZXNcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubiA9IGZ1bmN0aW9uKG1vZHVsZSkge1xuIFx0XHR2YXIgZ2V0dGVyID0gbW9kdWxlICYmIG1vZHVsZS5fX2VzTW9kdWxlID9cbiBcdFx0XHRmdW5jdGlvbiBnZXREZWZhdWx0KCkgeyByZXR1cm4gbW9kdWxlWydkZWZhdWx0J107IH0gOlxuIFx0XHRcdGZ1bmN0aW9uIGdldE1vZHVsZUV4cG9ydHMoKSB7IHJldHVybiBtb2R1bGU7IH07XG4gXHRcdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsICdhJywgZ2V0dGVyKTtcbiBcdFx0cmV0dXJuIGdldHRlcjtcbiBcdH07XG5cbiBcdC8vIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbFxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5vID0gZnVuY3Rpb24ob2JqZWN0LCBwcm9wZXJ0eSkgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcGVydHkpOyB9O1xuXG4gXHQvLyBfX3dlYnBhY2tfcHVibGljX3BhdGhfX1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5wID0gXCJcIjtcblxuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKF9fd2VicGFja19yZXF1aXJlX18ucyA9IFwiLi9TTzQvaW5kZXgudHNcIik7XG4iLCJpbXBvcnQge0V4cHJlc3N9IGZyb20gJ2V4cHJlc3MnO1xuaW1wb3J0IHsgU3RvcmVGYWN0b3J5LCBFdmVudCwgUmVkdWNpbmdTdGF0ZVN0b3JlLCBDaGFubmVsQ2xpZW50LCBNZW1vcnlDb25uZWN0b3IsIENoYW5uZWxDb25uZWN0b3IgfSBmcm9tIFwiY29tbW9uL2NoYW5uZWxzLWNvcmVcIjtcbmltcG9ydCB7IFNvY2tldElPQ2hhbm5lbFNlcnZlciB9IGZyb20gXCIuL2NoYW5uZWxzXCI7XG5cbmltcG9ydCB7ZmlsZXNSZWR1Y2VyLCBGaWxlc1N0YXRlU3RvcmUsIHN0b3JlRmFjdG9yeX0gZnJvbSAnY29tbW9uJztcbmltcG9ydCB7IE1vbmdvREJDb25uZWN0b3IgfSBmcm9tICcuL2NoYW5uZWxzL01vbmdvREJDb25uZWN0b3InO1xuXG5leHBvcnQgaW50ZXJmYWNlIENoYW5uZWxTZXJ2ZXJDb25maWcge1xuICAgIG1vbmdvZGI6IHtcbiAgICAgICAgdXJsOiBzdHJpbmc7XG4gICAgICAgIGRiTmFtZTogc3RyaW5nO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIENoYW5uZWxTZXJ2ZXIge1xuXG4gICAgX3NlcnZlcjogU29ja2V0SU9DaGFubmVsU2VydmVyO1xuICAgIF9jbGllbnQ6IENoYW5uZWxDbGllbnQ7XG4gICAgX2Nvbm5lY3RvcjogTW9uZ29EQkNvbm5lY3RvcjtcblxuICAgIGNvbnN0cnVjdG9yKGNvbmZpZzogQ2hhbm5lbFNlcnZlckNvbmZpZykge1xuICAgICAgICB0aGlzLl9jb25uZWN0b3IgPSBuZXcgTW9uZ29EQkNvbm5lY3Rvcihjb25maWcubW9uZ29kYi51cmwsIGNvbmZpZy5tb25nb2RiLmRiTmFtZSk7XG4gICAgICAgIHRoaXMuX2NsaWVudCA9IG5ldyBDaGFubmVsQ2xpZW50KHRoaXMuX2Nvbm5lY3Rvciwgc3RvcmVGYWN0b3J5KTtcbiAgICB9XG5cbiAgICBhc3luYyBjb25maWd1cmUoYXBwOiBFeHByZXNzLCBzb2NrZXQ6IFNvY2tldElPLlNlcnZlcikge1xuICAgICAgICBhd2FpdCB0aGlzLl9jb25uZWN0b3IuaW5pdCgpO1xuICAgICAgICB0aGlzLl9zZXJ2ZXIgPSBuZXcgU29ja2V0SU9DaGFubmVsU2VydmVyKHNvY2tldCwgdGhpcy5fY2xpZW50KVxuICAgIH1cbn0iLCJpbXBvcnQgeyBNb25nb0NsaWVudCwgRGIsIENvbGxlY3Rpb24gfSBmcm9tICdtb25nb2RiJztcbmltcG9ydCAqIGFzIHBpZnkgZnJvbSAncGlmeSc7XG5pbXBvcnQgeyBTdWJqZWN0IH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBDaGFubmVsQ29ubmVjdG9yLCBDaGFubmVsQ29ubmVjdGlvbiwgQ2hhbm5lbENvbm5lY3Rpb25SZXF1ZXN0LCBJQ2hhbm5lbCwgRXZlbnQsIE1lbW9yeUNvbm5lY3RvciwgQ29ubmVjdGlvbkhlbHBlciB9IGZyb20gJ2NvbW1vbi9jaGFubmVscy1jb3JlJztcblxuY29uc3QgY29ubmVjdCA9IHBpZnkoTW9uZ29DbGllbnQuY29ubmVjdCk7XG5cbmludGVyZmFjZSBDaGFubmVsU3RvcmFnZSB7XG4gICAgY2hhbm5lbDogc3RyaW5nO1xuICAgIHN0YXRlOiBhbnk7XG59XG5cbi8qKlxuICogRGVmaW5lcyBhIGNoYW5uZWwgY29ubmVjdG9yIHdoaWNoIGlzIGFibGUgdG8gcGlwZSBldmVudHMgdG8gTW9uZ29EQiBmb3Igc3RvcmFnZSBhbmQgbG9hZCBpbml0aWFsIGV2ZW50cyBmcm9tIE1vbmdvREIuXG4gKi9cbmV4cG9ydCBjbGFzcyBNb25nb0RCQ29ubmVjdG9yIGV4dGVuZHMgTWVtb3J5Q29ubmVjdG9yIHtcblxuICAgIHByaXZhdGUgX2NsaWVudDogTW9uZ29DbGllbnQ7XG4gICAgcHJpdmF0ZSBfZGI6IERiO1xuICAgIHByaXZhdGUgX2NvbGxlY3Rpb246IENvbGxlY3Rpb247XG4gICAgcHJpdmF0ZSBfdXJpOiBzdHJpbmc7XG4gICAgcHJpdmF0ZSBfZGJOYW1lOiBzdHJpbmc7XG4gICAgcHJpdmF0ZSBfY29sbGVjdGlvbk5hbWU6IHN0cmluZyA9ICdjaGFubmVscyc7XG5cbiAgICBjb25zdHJ1Y3Rvcih1cmk6IHN0cmluZywgZGJOYW1lOiBzdHJpbmcpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fdXJpID0gdXJpO1xuICAgICAgICB0aGlzLl9kYk5hbWUgPSBkYk5hbWU7XG4gICAgfVxuXG4gICAgYXN5bmMgaW5pdCgpIHtcbiAgICAgICAgdGhpcy5fY2xpZW50ID0gYXdhaXQgY29ubmVjdCh0aGlzLl91cmkpO1xuICAgICAgICB0aGlzLl9kYiA9IHRoaXMuX2NsaWVudC5kYih0aGlzLl9kYk5hbWUpO1xuICAgICAgICB0aGlzLl9jb2xsZWN0aW9uID0gdGhpcy5fZGIuY29sbGVjdGlvbih0aGlzLl9jb2xsZWN0aW9uTmFtZSk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIF9pbml0Q29ubmVjdGlvbjxUPihyZXF1ZXN0OiBDaGFubmVsQ29ubmVjdGlvblJlcXVlc3Q8VD4sIGhlbHBlcjogQ29ubmVjdGlvbkhlbHBlcjxUPik6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBhd2FpdCBzdXBlci5faW5pdENvbm5lY3Rpb24ocmVxdWVzdCwgaGVscGVyKTtcblxuICAgICAgICBjb25zb2xlLmxvZyhgW01vbmdvREJDb25uZWN0b3JdIEluaXRpYWxpemluZyBuZXcgY2hhbm5lbCAke3JlcXVlc3QuaW5mby5pZH0uIEdyYWJiaW5nIGluaXRpYWwgc3RhdGUuLi5gKTtcbiAgICAgICAgY29uc3Qgc3RvcmFnZTogQ2hhbm5lbFN0b3JhZ2UgPSBhd2FpdCB0aGlzLl9jb2xsZWN0aW9uLmZpbmRPbmUoeyBjaGFubmVsOiByZXF1ZXN0LmluZm8uaWQgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoc3RvcmFnZSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNb25nb0RCQ29ubmVjdG9yXSBVc2luZyBpbml0aWFsIHN0YXRlOicsIHN0b3JhZ2Uuc3RhdGUpO1xuICAgICAgICAgICAgcmVxdWVzdC5zdG9yZS5pbml0KHN0b3JhZ2Uuc3RhdGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNb25nb0RCQ29ubmVjdG9yXSBObyBpbml0aWFsIHN0YXRlLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaGVscGVyLnNldEVtaXRUb1N0b3JlRnVuY3Rpb24oZXZlbnQgPT4ge1xuICAgICAgICAgICAgcmVxdWVzdC5zdG9yZS5wcm9jZXNzKGV2ZW50KTtcblxuICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSByZXF1ZXN0LnN0b3JlLnN0YXRlKCk7XG4gICAgICAgICAgICB0aGlzLl9jb2xsZWN0aW9uLnVwZGF0ZU9uZSh7IGNoYW5uZWw6IHJlcXVlc3QuaW5mby5pZCB9LCB7IFxuICAgICAgICAgICAgICAgICRzZXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgY2hhbm5lbDogcmVxdWVzdC5pbmZvLmlkLFxuICAgICAgICAgICAgICAgICAgICBzdGF0ZTogc3RhdGVcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIHVwc2VydDogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxufSIsImltcG9ydCB7IFNlcnZlciB9IGZyb20gJ3NvY2tldC5pbyc7XG5pbXBvcnQgeyBDaGFubmVsSW5mbywgRXZlbnQsIENoYW5uZWxDbGllbnQsIENoYW5uZWxDb25uZWN0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYW5uZWxzLWNvcmUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlcnZlckxpc3Qge1xuICAgIFtrZXk6IHN0cmluZ106IENoYW5uZWxDb25uZWN0aW9uPGFueT47XG59XG5cbi8qKlxuICogRGVmaW5lcyBhIGNsYXNzIHdoaWNoIGFjdHMgYXMgYSBzZXJ2ZXIgZm9yIFNvY2tldElPIGNoYW5uZWxzIHN1Y2ggdGhhdCBcbiAqIGFueSBDaGFubmVsQ2xpZW50ICh3aGV0aGVyIHJ1bm5pbmcgb24gdGhlIHNlcnZlciBvciBvbiBhIGNsaWVudCkgd2hpY2ggdXNlcyBhIFNvY2tldElPQ2hhbm5lbENvbm5lY3RvclxuICogaXMgYWJsZSB0byBjb25uZWN0IHRvIGNoYW5uZWxzLlxuICovXG5leHBvcnQgY2xhc3MgU29ja2V0SU9DaGFubmVsU2VydmVyIHtcblxuICAgIHByaXZhdGUgX3NlcnZlcjogU2VydmVyO1xuICAgIHByaXZhdGUgX2NsaWVudDogQ2hhbm5lbENsaWVudDtcbiAgICBwcml2YXRlIF9zZXJ2ZXJMaXN0OiBTZXJ2ZXJMaXN0O1xuICAgIHByaXZhdGUgX3VzZXJDb3VudDogbnVtYmVyO1xuXG4gICAgY29uc3RydWN0b3Ioc2VydmVyOiBTZXJ2ZXIsIGNsaWVudDogQ2hhbm5lbENsaWVudCkge1xuICAgICAgICB0aGlzLl9zZXJ2ZXJMaXN0ID0ge307XG4gICAgICAgIHRoaXMuX2NsaWVudCA9IGNsaWVudDtcbiAgICAgICAgdGhpcy5fc2VydmVyID0gc2VydmVyO1xuICAgICAgICB0aGlzLl91c2VyQ291bnQgPSAwO1xuXG4gICAgICAgIHRoaXMuX3NlcnZlci5vbignY29ubmVjdGlvbicsIHNvY2tldCA9PiB7XG4gICAgICAgICAgICB0aGlzLl91c2VyQ291bnQgKz0gMTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbU29ja2V0SU9DaGFubmVsU2VydmVyXSBBIHVzZXIgY29ubmVjdGVkISBUaGVyZSBhcmUgbm93JywgdGhpcy5fdXNlckNvdW50LCAndXNlcnMgY29ubmVjdGVkLicpO1xuXG4gICAgICAgICAgICBzb2NrZXQub24oJ2pvaW5fc2VydmVyJywgKGluZm86IENoYW5uZWxJbmZvLCBjYWxsYmFjazogRnVuY3Rpb24pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW1NvY2tldElPQ2hhbm5lbFNlcnZlcl0gSm9pbmluZyB1c2VyIHRvIHNlcnZlcicsIGluZm8uaWQpO1xuICAgICAgICAgICAgICAgIHNvY2tldC5qb2luKGluZm8uaWQsIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NsaWVudC5nZXRDaGFubmVsKGluZm8pLnN1YnNjcmliZSgpLnRoZW4oY29ubmVjdGlvbiA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX3NlcnZlckxpc3RbaW5mby5pZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXJ2ZXJMaXN0W2luZm8uaWRdID0gY29ubmVjdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV2ZW50TmFtZSA9IGBuZXdfZXZlbnRfJHtpbmZvLmlkfWA7XG4gICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaXN0ZW5lciA9IChldmVudDogRXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25uZWN0aW9uLmVtaXQoZXZlbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNvY2tldC50byhpbmZvLmlkKS5lbWl0KGV2ZW50TmFtZSwgZXZlbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvY2tldC5vbihldmVudE5hbWUsIGxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvY2tldC5vbignbGVhdmVfc2VydmVyJywgKGlkOiBzdHJpbmcsIGNhbGxiYWNrOiBGdW5jdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpZCA9PT0gaW5mby5pZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25uZWN0aW9uLnVuc3Vic2NyaWJlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNvY2tldC5vZmYoZXZlbnROYW1lLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBjb25uZWN0aW9uLmluZm8sIGNvbm5lY3Rpb24uc3RvcmUuc3RhdGUoKSk7XG4gICAgICAgICAgICAgICAgICAgIH0sIGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHNvY2tldC5vbignZGlzY29ubmVjdCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl91c2VyQ291bnQgLT0gMTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW1NvY2tldElPQ2hhbm5lbFNlcnZlcl0gQSB1c2VyIGRpc2Nvbm5lY3RlZCEgVGhlcmUgYXJlIG5vdycsIHRoaXMuX3VzZXJDb3VudCwgJ3VzZXJzIGNvbm5lY3RlZC4nKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuICAgIH1cblxufSIsIlxuZXhwb3J0ICogZnJvbSAnLi9Tb2NrZXRJT0NoYW5uZWxTZXJ2ZXInOyIsIlxuaW1wb3J0IHsgU2VydmVyLCBDb25maWcgfSBmcm9tICcuL3NlcnZlcic7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5jb25zdCBjb25maWc6IENvbmZpZyA9IHtcbiAgICBzb2NrZXQ6IHtcbiAgICAgICAgcGluZ0ludGVydmFsOiAyMDAwLFxuICAgICAgICBwaW5nVGltZW91dDogMTAwMDAsXG4gICAgfSxcbiAgICBzb2NrZXRQb3J0OiA0NTY3LFxuICAgIGh0dHBQb3J0OiAzMDAwLFxuICAgIGNsaWVudDoge1xuICAgICAgICBkaXN0OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAnV2ViQ2xpZW50JywgJ2Rpc3QnKVxuICAgIH0sXG4gICAgY2hhbm5lbHM6IHtcbiAgICAgICAgbW9uZ29kYjoge1xuICAgICAgICAgICAgdXJsOiAnbW9uZ29kYjovL2RiLTA0LjEuYmFjay1lbmQuaW86MjcwMTcnLFxuICAgICAgICAgICAgZGJOYW1lOiAnU080J1xuICAgICAgICB9XG4gICAgfVxufTtcblxuY29uc3Qgc2VydmVyID0gbmV3IFNlcnZlcihjb25maWcpO1xuXG5hc3luYyBmdW5jdGlvbiBpbml0KCkge1xuICAgIGF3YWl0IHNlcnZlci5jb25maWd1cmUoKTtcbiAgICBzZXJ2ZXIuc3RhcnQoKTtcbn1cblxuaW5pdCgpO1xuIiwiaW1wb3J0ICogYXMgSHR0cCBmcm9tICdodHRwJztcbmltcG9ydCAqIGFzIGV4cHJlc3MgZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgKiBhcyBib2R5UGFyc2VyIGZyb20gJ2JvZHktcGFyc2VyJztcbmltcG9ydCAqIGFzIFNvY2tldElPIGZyb20gJ3NvY2tldC5pbyc7XG5pbXBvcnQgeyBTb2NrZXRJT0NoYW5uZWxTZXJ2ZXIgfSBmcm9tICcuL2NoYW5uZWxzJztcbmltcG9ydCB7IENoYW5uZWxDbGllbnQgfSBmcm9tICdjb21tb24vY2hhbm5lbHMtY29yZSc7XG5pbXBvcnQgeyBDaGFubmVsU2VydmVyLCBDaGFubmVsU2VydmVyQ29uZmlnIH0gZnJvbSAnLi9DaGFubmVsU2VydmVyJztcbmltcG9ydCB7IGFzeW5jTWlkZGxld2FyZSB9IGZyb20gJy4vdXRpbHMnO1xuXG4vKipcbiAqIFRoZSBzZXJ2ZXIgY29uZmlnLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbmZpZyB7XG4gICAgc29ja2V0OiBTb2NrZXRJTy5TZXJ2ZXJPcHRpb25zLFxuICAgIHNvY2tldFBvcnQ6IG51bWJlcixcbiAgICBodHRwUG9ydDogbnVtYmVyLFxuICAgIGNsaWVudDoge1xuICAgICAgICBkaXN0OiBzdHJpbmc7XG4gICAgfSxcbiAgICBjaGFubmVsczogQ2hhbm5lbFNlcnZlckNvbmZpZ1xufTtcblxuLyoqXG4gKiBEZWZpbmVzIGEgY2xhc3MgdGhhdCByZXByZXNlbnRzIGEgZnVsbHkgZmVhdHVyZWQgU080IHNlcnZlci5cbiAqL1xuZXhwb3J0IGNsYXNzIFNlcnZlciB7XG5cbiAgICBfYXBwOiBleHByZXNzLkV4cHJlc3M7XG4gICAgX2h0dHA6IEh0dHAuU2VydmVyO1xuICAgIF9zb2NrZXQ6IFNvY2tldElPLlNlcnZlcjtcbiAgICBfY2hhbm5lbFNlcnZlcjogQ2hhbm5lbFNlcnZlcjtcbiAgICBfY29uZmlnOiBDb25maWc7XG5cbiAgICBjb25zdHJ1Y3Rvcihjb25maWc6IENvbmZpZykge1xuICAgICAgICB0aGlzLl9jb25maWcgPSBjb25maWc7XG4gICAgICAgIHRoaXMuX2FwcCA9IGV4cHJlc3MoKTtcbiAgICAgICAgdGhpcy5faHR0cCA9IG5ldyBIdHRwLlNlcnZlcih0aGlzLl9hcHApO1xuICAgICAgICB0aGlzLl9zb2NrZXQgPSBTb2NrZXRJTyh0aGlzLl9odHRwLCBjb25maWcuc29ja2V0KTtcblxuICAgICAgICB0aGlzLl9jaGFubmVsU2VydmVyID0gbmV3IENoYW5uZWxTZXJ2ZXIoY29uZmlnLmNoYW5uZWxzKTtcbiAgICB9XG5cbiAgICBhc3luYyBjb25maWd1cmUoKSB7XG4gICAgICAgIHRoaXMuX2FwcC51c2UoYm9keVBhcnNlci5qc29uKCkpO1xuICAgICAgICBhd2FpdCB0aGlzLl9jaGFubmVsU2VydmVyLmNvbmZpZ3VyZSh0aGlzLl9hcHAsIHRoaXMuX3NvY2tldCk7XG5cbiAgICAgICAgdGhpcy5fYXBwLnVzZSgnLycsIGV4cHJlc3Muc3RhdGljKHRoaXMuX2NvbmZpZy5jbGllbnQuZGlzdCkpO1xuXG4gICAgICAgIHRoaXMuX2FwcC5wb3N0KCcvYXBpL3VzZXJzJywgYXN5bmNNaWRkbGV3YXJlKGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICAgICAgY29uc3QganNvbiA9IHJlcS5ib2R5O1xuICAgICAgICAgICAgY29uc3QgdXNlcm5hbWUgPSBqc29uLmVtYWlsLnNwbGl0KCdAJylbMF07XG5cbiAgICAgICAgICAgIC8vIFRPRE86IERvIHNvbWV0aGluZyBsaWtlIGFjdHVhbCB1c2VyIGxvZ2luXG4gICAgICAgICAgICByZXMuc2VuZCh7XG4gICAgICAgICAgICAgICAgZW1haWw6IGpzb24uZW1haWwsXG4gICAgICAgICAgICAgICAgdXNlcm5hbWU6IHVzZXJuYW1lLFxuICAgICAgICAgICAgICAgIG5hbWU6IHVzZXJuYW1lXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIHN0YXJ0KCkge1xuICAgICAgICB0aGlzLl9odHRwLmxpc3Rlbih0aGlzLl9jb25maWcuaHR0cFBvcnQsICgpID0+IGNvbnNvbGUubG9nKGBFeGFtcGxlIGFwcCBsaXN0ZW5pbmcgb24gcG9ydCAke3RoaXMuX2NvbmZpZy5odHRwUG9ydH0hYCkpO1xuICAgIH1cbn07IiwiaW1wb3J0IHtSZXF1ZXN0LCBSZXNwb25zZSwgSGFuZGxlcn0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgeyBBeGlvc0Vycm9yIH0gZnJvbSAnYXhpb3MnO1xuXG5leHBvcnQgY29uc3QgYXN5bmNNaWRkbGV3YXJlOiAoZm46IEhhbmRsZXIpID0+IEhhbmRsZXIgPSAoZm46IEhhbmRsZXIpID0+IHtcbiAgICByZXR1cm4gKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgIFByb21pc2UucmVzb2x2ZShmbihyZXEsIHJlcywgbmV4dCkpXG4gICAgICAgICAgICAuY2F0Y2goZXIgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVyciA6IEF4aW9zRXJyb3IgPSBlcjtcbiAgICAgICAgICAgICAgICBpZihlcnIucmVzcG9uc2UgJiYgZXJyLnJlc3BvbnNlLmRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQW4gQXhpb3MgcmVxdWVzdCBmYWlsZWQuJywgZXJyLCBlcnIucmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbmV4dChlcik7XG4gICAgICAgICAgICB9KTtcbiAgICB9O1xufSIsImltcG9ydCB7IFJlZHVjaW5nU3RhdGVTdG9yZSwgRXZlbnQgfSBmcm9tIFwiLi9jaGFubmVscy1jb3JlXCI7XG5pbXBvcnQge0ZpbGUsIE9iamVjdCwgV29ya3NwYWNlfSBmcm9tICcuL0ZpbGUnO1xuaW1wb3J0IHttZXJnZSwgZmlsdGVyfSBmcm9tICdsb2Rhc2gnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVzU3RhdGUge1xuICAgIFtpZDogc3RyaW5nXTogRmlsZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQYXJ0aWFsRmlsZSB7XG4gICAgaWQ/OiBzdHJpbmc7XG4gICAgdHlwZT86IHN0cmluZztcbiAgICBzaXplPzogbnVtYmVyO1xuICAgIHBvc2l0aW9uPzoge1xuICAgICAgICB4OiBudW1iZXI7XG4gICAgICAgIHk6IG51bWJlcjtcbiAgICAgICAgejogbnVtYmVyO1xuICAgIH07XG4gICAgdGFncz86IHtcbiAgICAgICAgX3dvcmtzcGFjZT86IHN0cmluZztcbiAgICAgICAgX3Bvc2l0aW9uPzoge1xuICAgICAgICAgICAgeD86IG51bWJlcjtcbiAgICAgICAgICAgIHk/OiBudW1iZXI7XG4gICAgICAgICAgICB6PzogbnVtYmVyO1xuICAgICAgICB9O1xuICAgICAgICBba2V5OiBzdHJpbmddOiBhbnk7XG4gICAgfVxufVxuXG5leHBvcnQgdHlwZSBGaWxlRXZlbnQgPSBcbiAgICBGaWxlQWRkZWRFdmVudCB8IFxuICAgIEZpbGVSZW1vdmVkRXZlbnQgfCBcbiAgICBGaWxlVXBkYXRlZEV2ZW50O1xuXG5leHBvcnQgZnVuY3Rpb24gZmlsZXNSZWR1Y2VyKHN0YXRlOiBGaWxlc1N0YXRlLCBldmVudDogRmlsZUV2ZW50KSB7XG4gICAgc3RhdGUgPSBzdGF0ZSB8fCB7fTtcblxuICAgIGlmIChldmVudC50eXBlID09PSAnZmlsZV9hZGRlZCcpIHtcbiAgICAgICAgcmV0dXJuIG1lcmdlKHt9LCBzdGF0ZSwge1xuICAgICAgICAgICAgW2V2ZW50LmlkXTogZXZlbnQuZmlsZVxuICAgICAgICB9KTtcbiAgICB9IGVsc2UgaWYoZXZlbnQudHlwZSA9PT0gJ2ZpbGVfcmVtb3ZlZCcpIHtcbiAgICAgICAgY29uc3QgeyBbZXZlbnQuaWRdOiByZW1vdmVkLCAuLi5vdGhlcnMgfSA9IHN0YXRlO1xuICAgICAgICByZXR1cm4gb3RoZXJzO1xuICAgIH0gZWxzZSBpZihldmVudC50eXBlID09PSAnZmlsZV91cGRhdGVkJykge1xuICAgICAgICBjb25zdCBuZXdEYXRhID0gbWVyZ2Uoe30sIHN0YXRlLCB7XG4gICAgICAgICAgICBbZXZlbnQuaWRdOiBldmVudC51cGRhdGVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZm9yKGxldCBwcm9wZXJ0eSBpbiBuZXdEYXRhW2V2ZW50LmlkXS50YWdzKSB7XG4gICAgICAgICAgICBsZXQgdmFsdWUgPSBuZXdEYXRhW2V2ZW50LmlkXS50YWdzW3Byb3BlcnR5XTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBuZXdEYXRhW2V2ZW50LmlkXS50YWdzW3Byb3BlcnR5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXdEYXRhO1xuICAgIH1cblxuICAgIHJldHVybiBzdGF0ZTtcbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVzU3RhdGVTdG9yZSBleHRlbmRzIFJlZHVjaW5nU3RhdGVTdG9yZTxGaWxlc1N0YXRlPiB7XG4gICAgY29uc3RydWN0b3IoZGVmYXVsdFN0YXRlOiBGaWxlc1N0YXRlKSB7XG4gICAgICAgIHN1cGVyKGRlZmF1bHRTdGF0ZSwgZmlsZXNSZWR1Y2VyKTtcbiAgICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZUFkZGVkRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gICAgdHlwZTogJ2ZpbGVfYWRkZWQnO1xuICAgIGlkOiBzdHJpbmc7XG4gICAgZmlsZTogRmlsZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBGaWxlUmVtb3ZlZEV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICAgIHR5cGU6ICdmaWxlX3JlbW92ZWQnO1xuICAgIGlkOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZVVwZGF0ZWRFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgICB0eXBlOiAnZmlsZV91cGRhdGVkJztcbiAgICBpZDogc3RyaW5nO1xuICAgIHVwZGF0ZTogUGFydGlhbEZpbGU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmaWxlQWRkZWQoZmlsZTogRmlsZSk6IEZpbGVBZGRlZEV2ZW50IHtcbiAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnZmlsZV9hZGRlZCcsXG4gICAgICAgIGlkOiBmaWxlLmlkLFxuICAgICAgICBmaWxlOiBmaWxlLFxuICAgICAgICBjcmVhdGlvbl90aW1lOiBuZXcgRGF0ZSgpXG4gICAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbGVSZW1vdmVkKGZpbGU6IEZpbGUpOiBGaWxlUmVtb3ZlZEV2ZW50IHtcbiAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnZmlsZV9yZW1vdmVkJyxcbiAgICAgICAgaWQ6IGZpbGUuaWQsXG4gICAgICAgIGNyZWF0aW9uX3RpbWU6IG5ldyBEYXRlKClcbiAgICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmlsZVVwZGF0ZWQoaWQ6IHN0cmluZywgdXBkYXRlOiBQYXJ0aWFsRmlsZSk6IEZpbGVVcGRhdGVkRXZlbnQge1xuICAgIHJldHVybiB7XG4gICAgICAgIHR5cGU6ICdmaWxlX3VwZGF0ZWQnLFxuICAgICAgICBpZDogaWQsXG4gICAgICAgIHVwZGF0ZTogdXBkYXRlLFxuICAgICAgICBjcmVhdGlvbl90aW1lOiBuZXcgRGF0ZSgpXG4gICAgfTtcbn0iLCJpbXBvcnQgeyBDaGFubmVsQ29ubmVjdGlvbiB9IGZyb20gXCIuL0NoYW5uZWxDb25uZWN0b3JcIjtcbmltcG9ydCB7IENoYW5uZWxDb25uZWN0b3IgfSBmcm9tIFwiLi9DaGFubmVsQ29ubmVjdG9yXCI7XG5pbXBvcnQgeyBTdGF0ZVN0b3JlIH0gZnJvbSBcIi4vU3RhdGVTdG9yZVwiO1xuXG4vKipcbiAqIEdlbmVyaWMgaW5mb3JtYXRpb24gYWJvdXQgYSBjaGFubmVsLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENoYW5uZWxJbmZvIHtcbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiB0aGUgY2hhbm5lbC5cbiAgICAgKiBUaGlzIGluZGljYXRlcyB3aGF0IHR5cGUgb2Ygc3RhdGUgc3RvcmUgYSBjaGFubmVsIHNob3VsZCB1c2UuXG4gICAgICovXG4gICAgdHlwZTogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHVuaXF1ZSBJRCBvZiB0aGUgY2hhbm5lbC5cbiAgICAgKiBHVUlEcyBhcmUgdXN1YWxseSB1c2VkIGZvciBwcml2YXRlIGludml0ZS1vbmx5IGNoYW5uZWxzIHdoaWxlXG4gICAgICogc3RydWN0dXJlZCBuYW1lcyBhcmUgdXNlZCBmb3IgcHVibGljIGNoYW5uZWxzLiAobGlrZSBgbmFtZXNwYWNlL3Jvb20vY2hhbm5lbC1uYW1lYClcbiAgICAgKi9cbiAgICBpZDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGh1bWFuLXJlYWRhYmxlIG5hbWUgb2YgdGhlIGNoYW5uZWwuXG4gICAgICovXG4gICAgbmFtZTogc3RyaW5nIHwgbnVsbDtcbn1cblxuLyoqXG4gKiBEZWZpbmVzIGFuIGludGVyZmFjZSB0aGF0IHJlcHJlc2VudHMgYW4gaW50ZXJmYWNlLlxuICogVGhhdCBpcywgYW4gYXN5bmNocm9ub3VzIHN0cmVhbSBvZiBldmVudHMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYW5uZWw8VD4ge1xuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgdW5pcXVlIElEIG9mIHRoZSBjaGFubmVsLlxuICAgICAqL1xuICAgIGlkKCk6IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIEJhc2ljIGluZm8gYWJvdXQgdGhlIGNoYW5uZWwuXG4gICAgICovXG4gICAgaW5mbygpOiBDaGFubmVsSW5mbztcblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHRzIHRvIHN1YnNjcmliZSB0byB0aGUgY2hhbm5lbC5cbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB3aGljaCByZXNvbHZlcyB3aXRoIGEgY2hhbm5lbCBzdWJzY3JpcHRpb24gdGhhdCBjYW4gYmUgdXNlZFxuICAgICAqIHRvIGludGVyYWN0IHdpdGggYSBjaGFubmVsLlxuICAgICAqL1xuICAgIHN1YnNjcmliZSgpOiBQcm9taXNlPENoYW5uZWxDb25uZWN0aW9uPFQ+Pjtcbn1cblxuLyoqXG4gKiBEZWZhdWx0IGltcGxlbWVudGF0aW9uIG9mIElDaGFubmVsLlxuICovXG5leHBvcnQgY2xhc3MgQ2hhbm5lbDxUPiBpbXBsZW1lbnRzIElDaGFubmVsPFQ+IHtcblxuICAgIHByaXZhdGUgX2Nvbm5lY3RvcjogQ2hhbm5lbENvbm5lY3RvcjtcbiAgICBwcml2YXRlIF9zdG9yZTogU3RhdGVTdG9yZTxUPjtcbiAgICBwcml2YXRlIF9pbmZvOiBDaGFubmVsSW5mbztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgQ2hhbm5lbCB3aGljaCB1c2VzIHRoZSBnaXZlbiBzZXJ2aWNlcy5cbiAgICAgKiBAcGFyYW0gaW5mbyBUaGUgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGNoYW5uZWwuXG4gICAgICogQHBhcmFtIGNvbm5lY3RvciBBIHNlcnZpY2Ugd2hpY2ggY2FuIGNvbm5lY3QgYSBjaGFubmVsIHRvIGEgbmV0d29yay4gKFdlYlNvY2tldHMsIEJsdWV0b290aCwgZXRjLilcbiAgICAgKiBAcGFyYW0gc3RvcmUgQSBzZXJ2aWNlIG1hbmFnZXMgdGhlIHN0YXRlIGZvciB0aGlzIGNoYW5uZWwuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoaW5mbzogQ2hhbm5lbEluZm8sIGNvbm5lY3RvcjogQ2hhbm5lbENvbm5lY3Rvciwgc3RvcmU6IFN0YXRlU3RvcmU8VD4pIHtcbiAgICAgICAgdGhpcy5faW5mbyA9IGluZm87XG4gICAgICAgIHRoaXMuX2Nvbm5lY3RvciA9IGNvbm5lY3RvcjtcbiAgICAgICAgdGhpcy5fc3RvcmUgPSBzdG9yZTtcbiAgICB9XG5cbiAgICBpZCgpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gdGhpcy5faW5mby5pZDtcbiAgICB9XG5cbiAgICBzdWJzY3JpYmUoKTogUHJvbWlzZTxDaGFubmVsQ29ubmVjdGlvbjxUPj4ge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29ubmVjdG9yLmNvbm5lY3RUb0NoYW5uZWw8VD4oe1xuICAgICAgICAgICAgaW5mbzogdGhpcy5pbmZvKCksXG4gICAgICAgICAgICBzdG9yZTogdGhpcy5fc3RvcmVcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaW5mbygpOiBDaGFubmVsSW5mbyB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbmZvO1xuICAgIH1cbn0iLCJpbXBvcnQgeyBJQ2hhbm5lbCwgQ2hhbm5lbCwgQ2hhbm5lbEluZm8gfSBmcm9tICcuL0NoYW5uZWwnO1xuaW1wb3J0IHsgQ2hhbm5lbENvbm5lY3RvciB9IGZyb20gJy4vQ2hhbm5lbENvbm5lY3Rvcic7XG5pbXBvcnQgeyBEaXNjb3ZlcnlDaGFubmVsSW5mbywgY3JlYXRlRGlzY292ZXJ5Q2hhbm5lbFN0YXRlU3RvcmUgfSBmcm9tICcuL2J1aWx0aW4vRGlzY292ZXJ5Q2hhbm5lbCc7XG5pbXBvcnQgeyBTdGF0ZVN0b3JlRmFjdG9yeSwgU3RhdGVTdG9yZSB9IGZyb20gJy4vU3RhdGVTdG9yZSc7XG5cbi8qKlxuICogRGVmaW5lcyBhbiBpbnRlcmZhY2UgZm9yIG9iamVjdHMgd2hpY2ggYXJlIGFibGUgdG8gaW50ZXJmYWNlIHdpdGggY2hhbm5lbCBzZXJ2ZXJzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElDaGFubmVsQ2xpZW50IHtcblxuICAgIC8qKlxuICAgICAqIFJlcXVlc3RzIGEgc3BlY2lhbCBjaGFubmVsIHdoaWNoIHRyYWNrcyBjdXJyZW50bHkgYWN0aXZlIGFuZCBwdWJsaWNseSBhdmFpbGFibGUgY2hhbm5lbHMuXG4gICAgICovXG4gICAgZGlzY292ZXJ5Q2hhbm5lbCgpOiBJQ2hhbm5lbDxDaGFubmVsSW5mb1tdPjtcblxuICAgIC8qKlxuICAgICAqIEdldHMgYSBjaGFubmVsIGZvciB0aGUgZ2l2ZW4gaW5mby4gSWYgdGhlIGNoYW5uZWwgZG9lc24ndCBleGlzdCwgdGhlbiBhIG5ldyBvbmUgaXMgY3JlYXRlZC5cbiAgICAgKiBAcGFyYW0gaW5mbyBUaGUgaW5mbyB0aGF0IGRlc2NyaWJlcyB0aGUgY2hhbm5lbC5cbiAgICAgKiBAcGFyYW0gcmVkdWNlciBUaGUgcmVkdWNlciB1c2VkIHRvIG1hbmFnZSBzdGF0ZSBmb3IgdGhlIGNoYW5uZWwuXG4gICAgICovXG4gICAgZ2V0Q2hhbm5lbDxUPihpbmZvOiBDaGFubmVsSW5mbyk6IElDaGFubmVsPFQ+O1xufVxuXG4vKipcbiAqIERlZmluZXMgYSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIG9mIGEgY2hhbm5lbCBjbGllbnQuXG4gKi9cbmV4cG9ydCBjbGFzcyBDaGFubmVsQ2xpZW50IGltcGxlbWVudHMgSUNoYW5uZWxDbGllbnQge1xuXG4gICAgcHJpdmF0ZSBfZGlzY292ZXJ5X2NoYW5uZWw6IElDaGFubmVsPENoYW5uZWxJbmZvW10+O1xuICAgIHByaXZhdGUgX2Nvbm5lY3RvcjogQ2hhbm5lbENvbm5lY3RvcjtcbiAgICBwcml2YXRlIF9zdG9yZUZhY3Rvcnk6IFN0YXRlU3RvcmVGYWN0b3J5O1xuXG4gICAgY29uc3RydWN0b3IoY29ubmVjdG9yOiBDaGFubmVsQ29ubmVjdG9yLCBzdG9yZUZhY3Rvcnk6IFN0YXRlU3RvcmVGYWN0b3J5KSB7XG4gICAgICAgIHRoaXMuX2Nvbm5lY3RvciA9IGNvbm5lY3RvcjtcbiAgICAgICAgdGhpcy5fc3RvcmVGYWN0b3J5ID0gc3RvcmVGYWN0b3J5O1xuICAgICAgICB0aGlzLl9kaXNjb3ZlcnlfY2hhbm5lbCA9IHRoaXMuZ2V0Q2hhbm5lbFdpdGhTdG9yZTxDaGFubmVsSW5mb1tdPihEaXNjb3ZlcnlDaGFubmVsSW5mbywgY3JlYXRlRGlzY292ZXJ5Q2hhbm5lbFN0YXRlU3RvcmUoKSk7XG4gICAgfVxuXG4gICAgZGlzY292ZXJ5Q2hhbm5lbCgpOiBJQ2hhbm5lbDxDaGFubmVsSW5mb1tdPiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kaXNjb3ZlcnlfY2hhbm5lbDtcbiAgICB9XG5cbiAgICBnZXRDaGFubmVsPFQ+KGluZm86IENoYW5uZWxJbmZvKTogSUNoYW5uZWw8VD4ge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRDaGFubmVsV2l0aFN0b3JlKGluZm8sIHRoaXMuX3N0b3JlRmFjdG9yeS5jcmVhdGUoaW5mbykpO1xuICAgIH1cblxuICAgIGdldENoYW5uZWxXaXRoU3RvcmU8VD4oaW5mbzogQ2hhbm5lbEluZm8sIHN0b3JlOiBTdGF0ZVN0b3JlPFQ+KTogSUNoYW5uZWw8VD4ge1xuICAgICAgICByZXR1cm4gbmV3IENoYW5uZWw8VD4oaW5mbywgdGhpcy5fY29ubmVjdG9yLCBzdG9yZSk7XG4gICAgfVxufSIsImltcG9ydCB7IEV2ZW50IH0gZnJvbSBcIi4vRXZlbnRcIjtcbmltcG9ydCB7IFJlZHVjZXIgfSBmcm9tIFwiLi9SZWR1Y2VyXCI7XG5pbXBvcnQgeyBDaGFubmVsSW5mbyB9IGZyb20gXCIuL0NoYW5uZWxcIjtcblxuLyoqXG4gKiBEZWZpbmVzIGFuIGludGVyZmFjZSBmb3Igb2JqZWN0cyB0aGF0IG1hbmFnZSBzdGF0ZXMgYW5kIGhvdyBldmVudHMgYWZmZWN0IHRob3NlIHN0YXRlcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTdGF0ZVN0b3JlPFQ+IHtcblxuICAgIC8qKlxuICAgICAqIFByb2Nlc3NlcyB0aGUgZ2l2ZW4gZXZlbnQgYW5kIGluY29ycG9yYXRlcyBpdHMgY2hhbmdlcyBpbnRvIHRoaXMgc3RhdGUuXG4gICAgICogQHBhcmFtIGV2ZW50IFxuICAgICAqL1xuICAgIHByb2Nlc3MoZXZlbnQ6IEV2ZW50KTogdm9pZDtcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemVzIHRoZSBzdGF0ZSBzdG9yZSB3aXRoIHRoZSBnaXZlbiBzdGF0ZS5cbiAgICAgKiBAcGFyYW0gc3RhdGUgVGhlIHN0YXRlLlxuICAgICAqL1xuICAgIGluaXQoc3RhdGU/OiBUKTogdm9pZDtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHN0YXRlIHRoYXQgdGhpcyBzdG9yZSBjdXJyZW50bHkgY29udGFpbnMuXG4gICAgICovXG4gICAgc3RhdGUoKTogVDtcbn1cblxuLyoqXG4gKiBEZWZpbmVzIGFuIGludGVyZmFjZSBmb3Igb2JqZWN0cyB0aGF0IGNhbiBjcmVhdGUgc3RhdGUgc3RvcmVzIGZvciBwYXJ0aWN1bGFyIGNoYW5uZWxzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFN0YXRlU3RvcmVGYWN0b3J5IHtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgc3RhdGUgc3RvcmUgZm9yIHRoZSBnaXZlbiBjaGFubmVsIGluZm8uXG4gICAgICogQHBhcmFtIGluZm8gVGhlIGluZm8gZGVzY3JpYmluZyB0aGUgY2hhbm5lbC5cbiAgICAgKi9cbiAgICBjcmVhdGU8VD4oaW5mbzogQ2hhbm5lbEluZm8pOiBTdGF0ZVN0b3JlPFQ+O1xufVxuXG4vKipcbiAqIERlZmluZXMgYSBzdGF0ZSBzdG9yZSB0aGF0IHVzZXMgYSBzcGVjaWFsIGZ1bmN0aW9uIGNhbGxlZCBhIHJlZHVjZXIgdG8gaW5jb3Jwb3JhdGVcbiAqIG5ldyBldmVudHMgaW50byB0aGUgc3RhdGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZWR1Y2luZ1N0YXRlU3RvcmU8VD4gaW1wbGVtZW50cyBTdGF0ZVN0b3JlPFQ+IHtcbiAgICBwcml2YXRlIF9zdGF0ZTogVDtcbiAgICBwcml2YXRlIF9yZWR1Y2VyOiBSZWR1Y2VyO1xuXG4gICAgY29uc3RydWN0b3IoZGVmYXVsdFN0YXRlOiBULCByZWR1Y2VyOiBSZWR1Y2VyKSB7XG4gICAgICAgIHRoaXMuX3N0YXRlID0gZGVmYXVsdFN0YXRlO1xuICAgICAgICB0aGlzLl9yZWR1Y2VyID0gcmVkdWNlcjtcbiAgICB9XG5cbiAgICBzdGF0ZSgpOiBUIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXRlO1xuICAgIH1cblxuICAgIHByb2Nlc3MoZXZlbnQ6IEV2ZW50KTogdm9pZCB7XG4gICAgICAgIHRoaXMuX3N0YXRlID0gdGhpcy5fcmVkdWNlcih0aGlzLl9zdGF0ZSwgZXZlbnQpO1xuICAgIH1cblxuICAgIGluaXQoc3RhdGU/OiBUKTogdm9pZCB7XG4gICAgICAgIGlmKHR5cGVvZiBzdGF0ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlID0gc3RhdGU7XG4gICAgICAgIH1cbiAgICB9XG59IiwiaW1wb3J0IHsgU3ViamVjdCwgT2JzZXJ2YWJsZSwgU3Vic2NyaXB0aW9uTGlrZSB9IGZyb20gJ3J4anMnXG5pbXBvcnQgeyBmaWx0ZXIsIG1hcCwgZmlyc3QsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IENoYW5uZWxJbmZvIH0gZnJvbSAnLi4vQ2hhbm5lbCc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uL0V2ZW50JztcbmltcG9ydCB7IFN0YXRlU3RvcmUgfSBmcm9tICcuLi9TdGF0ZVN0b3JlJztcbmltcG9ydCB7IENoYW5uZWxDb25uZWN0b3IsIENoYW5uZWxDb25uZWN0aW9uUmVxdWVzdCwgQ2hhbm5lbENvbm5lY3Rpb24gfSBmcm9tICcuLi9DaGFubmVsQ29ubmVjdG9yJztcblxuaW50ZXJmYWNlIEV2ZW50V3JhcHBlciB7XG4gICAgZXZlbnQ6IEV2ZW50O1xuICAgIGlzTG9jYWw6IGJvb2xlYW47XG59XG5cbi8qKlxuICogRGVmaW5lcyBhbiBpbnRlcmZhY2UgZm9yIG9iamVjdHMgd2hpY2ggaGVscCBzZXR1cCBhIGNvbm5lY3Rpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29ubmVjdGlvbkhlbHBlcjxUPiB7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBjb25uZWN0aW9uIHRoYXQgaXMgYmVpbmcgc2V0dXAuXG4gICAgICovXG4gICAgYnVpbGQ6ICgpID0+IENoYW5uZWxDb25uZWN0aW9uPFQ+O1xuXG4gICAgLyoqXG4gICAgICogU2V0cyBhbiBvYnNlcnZhYmxlIHRoYXQgcmVzb2x2ZXMgd2l0aCBhbiBldmVudCB3aGVuZXZlciBhbiBldmVudFxuICAgICAqIGlzIHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlci5cbiAgICAgKi9cbiAgICBzZXRTZXJ2ZXJFdmVudHM6IChzZXJ2ZXJFdmVudHM6IE9ic2VydmFibGU8RXZlbnQ+KSA9PiB2b2lkO1xuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgZnVuY3Rpb24gdGhhdCBpcyB1c2VkIHRvIGVtaXQgZXZlbnRzIHRvIHRoZSBzZXJ2ZXIuXG4gICAgICovXG4gICAgc2V0RW1pdFRvU2VydmVyRnVuY3Rpb246IChlbWl0OiAoZXZlbnQ6IEV2ZW50KSA9PiB2b2lkKSA9PiB2b2lkO1xuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgZnVuY3Rpb24gdGhhdCBpcyB1c2VkIHRvIGVtaXQgZXZlbnRzIHRvIHRoZSBsb2NhbCBzdG9yZS5cbiAgICAgKi9cbiAgICBzZXRFbWl0VG9TdG9yZUZ1bmN0aW9uOiAoZW1pdDogKGV2ZW50OiBFdmVudCkgPT4gdm9pZCkgPT4gdm9pZDtcbiAgICBcbiAgICAvKipcbiAgICAgKiBUaGUgb2JzZXJ2YWJsZSB0aGF0IGlzIHJlc29sdmVkIGEgc2luZ2xlIHRpbWUgd2hlbiBcbiAgICAgKiB0aGUgY29ubmVjdGlvbiBzaG91bGQgYmUgc2h1dCBkb3duLlxuICAgICAqL1xuICAgIG9uVW5zdWJzY3JpYmU6IE9ic2VydmFibGU8e30+O1xufVxuXG4vKipcbiAqIERlZmluZXMgYSBiYXNlIGNsYXNzIGZvciBjb25uZWN0b3JzLlxuICogVGhpcyBjbGFzcyBoZWxwcyBjcmVhdGUgY2hhbm5lbCBjb25uZWN0aW9ucyB3aGljaCBiZWhhdmUgY29ycmVjdGx5LlxuICovXG5leHBvcnQgY2xhc3MgQmFzZUNvbm5lY3RvciBpbXBsZW1lbnRzIENoYW5uZWxDb25uZWN0b3Ige1xuXG4gICAgY29ubmVjdFRvQ2hhbm5lbDxUPihjb25uZWN0aW9uX3JlcXVlc3Q6IENoYW5uZWxDb25uZWN0aW9uUmVxdWVzdDxUPik6IFByb21pc2U8Q2hhbm5lbENvbm5lY3Rpb248VD4+IHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQuJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBjaGFubmVsIGNvbm5lY3Rpb24gd2hpY2ggcGlwZXMgZXZlbnRzIHRvIHRoZSBjb3JyZWN0IGxvY2F0aW9ucy5cbiAgICAgKiBJbiBwYXJ0aWN1bGFyLCBldmVudHMgZW1pdHRlZCBsb2NhbGx5IGFyZSBzZW50IHRvIHRoZSBzZXJ2ZXIgd2hpbGUgZXZlbnRzIGVtaXR0ZWQgZnJvbSB0aGUgc2VydmVyXG4gICAgICogYXJlIHNlbmQgbG9jYWxseS4gU2VlIGVtaXRUb1NlcnZlciBhbmQgZW1pdEZyb21TZXJ2ZXIuXG4gICAgICogQHBhcmFtIGNvbm5lY3Rpb25fcmVxdWVzdFxuICAgICAqL1xuICAgIHByb3RlY3RlZCBuZXdDb25uZWN0aW9uPFQ+KGNvbm5lY3Rpb25fcmVxdWVzdDogQ2hhbm5lbENvbm5lY3Rpb25SZXF1ZXN0PFQ+KTogQ29ubmVjdGlvbkhlbHBlcjxUPiB7XG4gICAgICAgIGxldCBzdWJqZWN0ID0gbmV3IFN1YmplY3Q8RXZlbnRXcmFwcGVyPigpO1xuICAgICAgICBsZXQgaW5mbyA9IGNvbm5lY3Rpb25fcmVxdWVzdC5pbmZvO1xuICAgICAgICBsZXQgc3RvcmUgPSBjb25uZWN0aW9uX3JlcXVlc3Quc3RvcmU7XG4gICAgICAgIGxldCBzZXJ2ZXJFdmVudHM6IE9ic2VydmFibGU8RXZlbnQ+O1xuICAgICAgICBsZXQgb25VbnN1YnNjcmliZTogU3ViamVjdDx7fT4gPSBuZXcgU3ViamVjdDx7fT4oKTtcbiAgICAgICAgbGV0IGVtaXRUb1NlcnZlcjogKChldmVudDogRXZlbnQpID0+IHZvaWQpO1xuICAgICAgICBsZXQgZW1pdFRvU3RvcmU6ICgoZXZlbnQ6IEV2ZW50KSA9PiB2b2lkKTtcblxuICAgICAgICBsZXQgYnVpbGQ6ICgpID0+IENoYW5uZWxDb25uZWN0aW9uPFQ+ID0gKCkgPT4ge1xuICAgICAgICAgICAgbGV0IHN1YnM6IFN1YnNjcmlwdGlvbkxpa2VbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKHNlcnZlckV2ZW50cykgeyAgIFxuICAgICAgICAgICAgICAgIC8vIFBpcGUgdGhlIHNlcnZlciBldmVudHMgaW50byB0aGUgc3ViamVjdC5cbiAgICAgICAgICAgICAgICBzdWJzLnB1c2goc2VydmVyRXZlbnRzLnBpcGUobWFwKGUgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQ6IGUsXG4gICAgICAgICAgICAgICAgICAgIGlzTG9jYWw6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSkpKS5zdWJzY3JpYmUoc3ViamVjdCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZW1pdFRvU2VydmVyICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBzdWJzLnB1c2goc3ViamVjdC5waXBlKFxuICAgICAgICAgICAgICAgICAgICAgZmlsdGVyKGUgPT4gZS5pc0xvY2FsKSxcbiAgICAgICAgICAgICAgICAgICAgIG1hcChlID0+IGUuZXZlbnQpLFxuICAgICAgICAgICAgICAgICAgICAgdGFwKGUgPT4gZW1pdFRvU2VydmVyKGUpKVxuICAgICAgICAgICAgICAgICkuc3Vic2NyaWJlKCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWVtaXRUb1N0b3JlKSB7XG4gICAgICAgICAgICAgICAgZW1pdFRvU3RvcmUgPSBlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc3RvcmUucHJvY2VzcyhlKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBzdWJzLnB1c2goc3ViamVjdC5waXBlKFxuICAgICAgICAgICAgICAgICAgICBtYXAoZSA9PiBlLmV2ZW50KSxcbiAgICAgICAgICAgICAgICAgICAgdGFwKGVtaXRUb1N0b3JlKVxuICAgICAgICAgICAgICAgICkuc3Vic2NyaWJlKCkpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGVtaXQ6IChldmVudCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzdWJqZWN0Lm5leHQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICBpc0xvY2FsOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXZlbnRzOiBzdWJqZWN0LnBpcGUobWFwKGUgPT4gZS5ldmVudCkpLFxuICAgICAgICAgICAgICAgIHN0b3JlOiBjb25uZWN0aW9uX3JlcXVlc3Quc3RvcmUsXG4gICAgICAgICAgICAgICAgaW5mbzogY29ubmVjdGlvbl9yZXF1ZXN0LmluZm8sXG4gICAgICAgICAgICAgICAgdW5zdWJzY3JpYmU6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc3Vicy5mb3JFYWNoKHMgPT4gcy51bnN1YnNjcmliZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgc3ViamVjdC5jb21wbGV0ZSgpO1xuICAgICAgICAgICAgICAgICAgICBzdWJqZWN0LnVuc3Vic2NyaWJlKCk7XG4gICAgICAgICAgICAgICAgICAgIG9uVW5zdWJzY3JpYmUubmV4dCh7fSk7XG4gICAgICAgICAgICAgICAgICAgIG9uVW5zdWJzY3JpYmUuY29tcGxldGUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgbGV0IGhlbHBlcjogQ29ubmVjdGlvbkhlbHBlcjxUPiA9IHtcbiAgICAgICAgICAgIGJ1aWxkOiBidWlsZCxcbiAgICAgICAgICAgIHNldFNlcnZlckV2ZW50czogKGV2ZW50cykgPT4ge1xuICAgICAgICAgICAgICAgIHNlcnZlckV2ZW50cyA9IGV2ZW50cztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXRFbWl0VG9TZXJ2ZXJGdW5jdGlvbjogKGZuKSA9PiB7XG4gICAgICAgICAgICAgICAgZW1pdFRvU2VydmVyID0gZm47XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0RW1pdFRvU3RvcmVGdW5jdGlvbjogKGZuKSA9PiB7XG4gICAgICAgICAgICAgICAgZW1pdFRvU3RvcmUgPSBmbjtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvblVuc3Vic2NyaWJlOiBvblVuc3Vic2NyaWJlLnBpcGUoZmlyc3QoKSlcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gaGVscGVyO1xuICAgIH1cbn0iLCJpbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uL0V2ZW50JztcbmltcG9ydCB7IENoYW5uZWxJbmZvIH0gZnJvbSAnLi4vQ2hhbm5lbCc7XG5pbXBvcnQge3JlbW92ZX0gZnJvbSAnbG9kYXNoJztcbmltcG9ydCB7IFN0YXRlU3RvcmUsIFJlZHVjaW5nU3RhdGVTdG9yZSB9IGZyb20gJy4uL1N0YXRlU3RvcmUnO1xuXG4vKipcbiAqIENvbW1vbiBldmVudCBmb3IgYSBjaGFubmVsIGJlaW5nIGFkZGVkIHRvIHRoZSBzZXJ2ZXIgbGlzdC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDaGFubmVsQ3JlYXRlZEV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICAgIHR5cGU6ICdjaGFubmVsX2NyZWF0ZWQnO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGluZm8gZm9yIHRoZSBjaGFubmVsIHRoYXQgd2FzIGNyZWF0ZWQuXG4gICAgICovXG4gICAgaW5mbzogQ2hhbm5lbEluZm87XG59XG5cbi8qKlxuICogQ29tbW9uIGV2ZW50IGZvciBhIGNoYW5uZWwgYmVpbmcgcmVtb3ZlZCBmcm9tIHRoZSBzZXJ2ZXIgbGlzdC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDaGFubmVsUmVtb3ZlZEV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICAgIHR5cGU6ICdjaGFubmVsX3JlbW92ZWQnO1xuXG4gICAgLyoqXG4gICAgICogVGhlIElEIG9mIHRoZSBjaGFubmVsIHRoYXQgd2FzIHJlbW92ZWQuXG4gICAgICovXG4gICAgY2hhbm5lbF9pZDogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBEaXNjb3ZlcnlDaGFubmVsRXZlbnQgPSBDaGFubmVsQ3JlYXRlZEV2ZW50IHwgQ2hhbm5lbFJlbW92ZWRFdmVudDtcblxuLyoqXG4gKiBBIGZ1bmN0aW9uIHRoYXQgaXMgYWJsZSB0byBhcHBseSBkaXNjb3ZlcnkgZXZlbnRzIHRvIHRoZSBjaGFubmVsIHN0YXRlLlxuICogQHBhcmFtIHN0YXRlIFRoZSBjdXJyZW50IHN0YXRlLlxuICogQHBhcmFtIGV2ZW50IFRoZSBldmVudCB0aGF0IHNob3VsZCBiZSBhZGRlZCB0byB0aGUgc3RhdGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXNjb3ZlcnlDaGFubmVsUmVkdWNlcihzdGF0ZTogQ2hhbm5lbEluZm9bXSwgZXZlbnQ6IERpc2NvdmVyeUNoYW5uZWxFdmVudCk6IENoYW5uZWxJbmZvW10ge1xuICAgIHN0YXRlID0gc3RhdGUgfHwgW107XG4gICAgaWYgKGV2ZW50LnR5cGUgPT09ICdjaGFubmVsX3JlbW92ZWQnKSB7XG4gICAgICAgIHJlbW92ZShzdGF0ZSwgcyA9PiBzLmlkID09PSBldmVudC5jaGFubmVsX2lkKTtcbiAgICB9IGVsc2UgaWYgKGV2ZW50LnR5cGUgPT09ICdjaGFubmVsX2NyZWF0ZWQnKSB7XG4gICAgICAgIHN0YXRlLnB1c2goZXZlbnQuaW5mbyk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0ZTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IHN0YXRlIHN0b3JlIHRoYXQgc2hvdWxkIGJlIHVzZWQgd2l0aCBkaXNjb3ZlcnkgY2hhbm5lbHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEaXNjb3ZlcnlDaGFubmVsU3RhdGVTdG9yZSgpOiBTdGF0ZVN0b3JlPENoYW5uZWxJbmZvW10+IHtcbiAgICByZXR1cm4gbmV3IFJlZHVjaW5nU3RhdGVTdG9yZShbXSwgZGlzY292ZXJ5Q2hhbm5lbFJlZHVjZXIpO1xufVxuXG4vKipcbiAqIEluZm8gYWJvdXQgdGhlIGRpc2NvdmVyeSBjaGFubmVsLlxuICovXG5leHBvcnQgY29uc3QgRGlzY292ZXJ5Q2hhbm5lbEluZm86IENoYW5uZWxJbmZvID0ge1xuICAgIHR5cGU6ICdkaXNjb3ZlcnlfY2hhbm5lbCcsXG4gICAgaWQ6ICdkaXNjb3ZlcnlfY2hhbm5lbCcsXG4gICAgbmFtZTogJ0NoYW5uZWwgZm9yIGRpc2NvdmVyaW5nIG90aGVyIGNoYW5uZWxzLidcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBjaGFubmVsIGNyZWF0ZWQgZXZlbnQuXG4gKiBAcGFyYW0gaW5mbyBUaGUgaW5mbyBmb3IgdGhlIGNoYW5uZWwgdGhhdCB3YXMgY3JlYXRlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoYW5uZWxDcmVhdGVkKGluZm86IENoYW5uZWxJbmZvKTogQ2hhbm5lbENyZWF0ZWRFdmVudCB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZTogJ2NoYW5uZWxfY3JlYXRlZCcsXG4gICAgICAgIGNyZWF0aW9uX3RpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIGluZm86IGluZm9cbiAgICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgY2hhbm5lbCByZW1vdmVkIGV2ZW50LlxuICogQHBhcmFtIGluZm8gVGhlIGluZm8gZm9yIHRoZSBjaGFubmVsIHRoYXQgd2FzIGNyZWF0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjaGFubmVsUmVtb3ZlZChjaGFubmVsX2lkOiBzdHJpbmcpOiBDaGFubmVsUmVtb3ZlZEV2ZW50IHtcbiAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnY2hhbm5lbF9yZW1vdmVkJyxcbiAgICAgICAgY3JlYXRpb25fdGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgY2hhbm5lbF9pZDogY2hhbm5lbF9pZFxuICAgIH07XG59IiwiXG5pbXBvcnQgeyBDaGFubmVsQ29ubmVjdG9yLCBDaGFubmVsQ29ubmVjdGlvbiwgQ2hhbm5lbENvbm5lY3Rpb25SZXF1ZXN0IH0gZnJvbSAnLi4vQ2hhbm5lbENvbm5lY3Rvcic7XG5pbXBvcnQgeyBJQ2hhbm5lbCB9IGZyb20gJy4uL0NoYW5uZWwnO1xuaW1wb3J0IHsgU3ViamVjdCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi9FdmVudCc7XG5pbXBvcnQgeyBCYXNlQ29ubmVjdG9yLCBDb25uZWN0aW9uSGVscGVyIH0gZnJvbSAnLi9CYXNlQ29ubmVjdG9yJztcblxuaW50ZXJmYWNlIENoYW5uZWxMaXN0IHtcbiAgICBba2V5OiBzdHJpbmddOiBDaGFubmVsQ29ubmVjdGlvbjxhbnk+O1xufVxuXG4vKipcbiAqIERlZmluZXMgYSBjaGFubmVsIGNvbm5lY3RvciB3aGljaCBpcyBhYmxlIHRvIHBpcGUgZXZlbnRzIHRocm91Z2ggbWVtb3J5IHRvIG90aGVyIGNoYW5uZWxzLlxuICogU29tZXRpbWVzIHVzZWZ1bCBmb3Igc2VydmVycy5cbiAqL1xuZXhwb3J0IGNsYXNzIE1lbW9yeUNvbm5lY3RvciBleHRlbmRzIEJhc2VDb25uZWN0b3Ige1xuXG4gICAgcHJpdmF0ZSBfY2hhbm5lbHM6IENoYW5uZWxMaXN0O1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2NoYW5uZWxzID0ge307XG4gICAgfVxuXG4gICAgY29ubmVjdFRvQ2hhbm5lbDxUPihjb25uZWN0aW9uX3JlcXVlc3Q6IENoYW5uZWxDb25uZWN0aW9uUmVxdWVzdDxUPik6IFByb21pc2U8Q2hhbm5lbENvbm5lY3Rpb248VD4+IHtcbiAgICAgICAgaWYodGhpcy5fY2hhbm5lbHNbY29ubmVjdGlvbl9yZXF1ZXN0LmluZm8uaWRdKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2NoYW5uZWxzW2Nvbm5lY3Rpb25fcmVxdWVzdC5pbmZvLmlkXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY3JlYXRlTmV3Q29ubmVjdGlvbihjb25uZWN0aW9uX3JlcXVlc3QpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIF9jcmVhdGVOZXdDb25uZWN0aW9uPFQ+KGNvbm5lY3Rpb25fcmVxdWVzdDogQ2hhbm5lbENvbm5lY3Rpb25SZXF1ZXN0PFQ+KTogUHJvbWlzZTxDaGFubmVsQ29ubmVjdGlvbjxUPj4ge1xuICAgICAgICBsZXQgaGVscGVyID0gdGhpcy5uZXdDb25uZWN0aW9uKGNvbm5lY3Rpb25fcmVxdWVzdCk7XG4gICAgICAgIGF3YWl0IHRoaXMuX2luaXRDb25uZWN0aW9uKGNvbm5lY3Rpb25fcmVxdWVzdCwgaGVscGVyKTtcbiAgICAgICAgbGV0IGNvbm5lY3Rpb24gPSBoZWxwZXIuYnVpbGQoKTtcbiAgICAgICAgdGhpcy5fY2hhbm5lbHNbY29ubmVjdGlvbl9yZXF1ZXN0LmluZm8uaWRdID0gY29ubmVjdGlvbjtcbiAgICAgICAgcmV0dXJuIGNvbm5lY3Rpb247XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIF9pbml0Q29ubmVjdGlvbjxUPihyZXF1ZXN0OiBDaGFubmVsQ29ubmVjdGlvblJlcXVlc3Q8VD4sIGhlbHBlcjogQ29ubmVjdGlvbkhlbHBlcjxUPik6IFByb21pc2U8dm9pZD4ge1xuICAgIH1cblxufSIsImltcG9ydCB7IFN0YXRlU3RvcmVGYWN0b3J5LCBTdGF0ZVN0b3JlIH0gZnJvbSAnLi4vU3RhdGVTdG9yZSc7XG5pbXBvcnQgeyBDaGFubmVsSW5mbyB9IGZyb20gJy4uL0NoYW5uZWwnO1xuXG4vKipcbiAqIERlZmluZXMgYW4gaW50ZXJmYWNlIGZvciBhbiBvYmplY3QgdGhhdCBtYXBzIGNoYW5uZWwgdHlwZXNcbiAqIHRvIGluZGl2aWR1YWwgc3RhdGUgc3RvcmUgZmFjdG9yeSBmdW5jdGlvbnMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3RvcmVGYWN0b3J5TWFwIHtcbiAgICBba2V5OiBzdHJpbmddOiAoKSA9PiBTdGF0ZVN0b3JlPGFueT47XG59XG5cbi8qKlxuICogRGVmaW5lcyBhIGNsYXNzIHdoaWNoIHByb3ZpZGVzIGEgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiBvZiBhIFN0YXRlU3RvcmVGYWN0b3J5LlxuICovXG5leHBvcnQgY2xhc3MgU3RvcmVGYWN0b3J5IGltcGxlbWVudHMgU3RhdGVTdG9yZUZhY3Rvcnkge1xuXG4gICAgcHJpdmF0ZSBfbWFwOiBTdG9yZUZhY3RvcnlNYXA7XG5cbiAgICBjb25zdHJ1Y3RvcihtYXA/OiBTdG9yZUZhY3RvcnlNYXApIHtcbiAgICAgICAgdGhpcy5fbWFwID0gbWFwIHx8IHt9O1xuICAgIH1cblxuICAgIGNyZWF0ZTxUPihpbmZvOiBDaGFubmVsSW5mbyk6IFN0YXRlU3RvcmU8VD4ge1xuICAgICAgICBsZXQgZmFjdG9yeSA9IHRoaXMuX21hcFtpbmZvLnR5cGVdO1xuICAgICAgICBpZihmYWN0b3J5KSB7XG4gICAgICAgICAgICByZXR1cm4gZmFjdG9yeSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gY3JlYXRlIGEgZmFjdG9yeSBmb3IgY2hhbm5lbCBvZiB0eXBlOiBcIicgKyBpbmZvLnR5cGUgKyAnLiBObyBjb3JyZXNwb25kaW5nIGZ1bmN0aW9uIGV4aXN0cyBpbiB0aGUgbWFwLicpO1xuICAgICAgICB9XG4gICAgfVxufSIsImV4cG9ydCAqIGZyb20gJy4vQmFzZUNvbm5lY3Rvcic7XG5leHBvcnQgKiBmcm9tICcuL01lbW9yeUNvbm5lY3Rvcic7XG5leHBvcnQgKiBmcm9tICcuL0Rpc2NvdmVyeUNoYW5uZWwnO1xuZXhwb3J0ICogZnJvbSAnLi9TdG9yZUZhY3RvcnknOyIsIlxuZXhwb3J0ICogZnJvbSAnLi9FdmVudCc7XG5leHBvcnQgKiBmcm9tICcuL1JlZHVjZXInO1xuZXhwb3J0ICogZnJvbSAnLi9DaGFubmVsJztcbmV4cG9ydCAqIGZyb20gJy4vQ2hhbm5lbENsaWVudCc7XG5leHBvcnQgKiBmcm9tICcuL0NoYW5uZWxDb25uZWN0b3InO1xuZXhwb3J0ICogZnJvbSAnLi9TdGF0ZVN0b3JlJztcbmV4cG9ydCAqIGZyb20gJy4vYnVpbHRpbic7IiwiaW1wb3J0IHsgU3RvcmVGYWN0b3J5IH0gZnJvbSAnLi9jaGFubmVscy1jb3JlJztcbmltcG9ydCB7IEZpbGVzU3RhdGVTdG9yZSB9IGZyb20gJy4vRmlsZXNDaGFubmVsJztcblxuZXhwb3J0ICogZnJvbSAnLi9GaWxlJztcbmV4cG9ydCAqIGZyb20gJy4vRmlsZXNDaGFubmVsJztcblxuZXhwb3J0IGNvbnN0IHN0b3JlRmFjdG9yeSA9IG5ldyBTdG9yZUZhY3Rvcnkoe1xuICAgIGZpbGVzOiAoKSA9PiBuZXcgRmlsZXNTdGF0ZVN0b3JlKHt9KVxufSk7XG5cbmV4cG9ydCBjb25zdCBjaGFubmVsVHlwZXMgPSB7XG4gICAgZmlsZXM6ICdmaWxlcydcbn07IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiYm9keS1wYXJzZXJcIik7IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiZXhwcmVzc1wiKTsiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCJodHRwXCIpOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcImxvZGFzaFwiKTsiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCJtb25nb2RiXCIpOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcInBhdGhcIik7IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwicGlmeVwiKTsiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCJyeGpzXCIpOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcInJ4anMvb3BlcmF0b3JzXCIpOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcInNvY2tldC5pb1wiKTsiXSwic291cmNlUm9vdCI6IiJ9