"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var adalLib = require("adal-angular");
var core_1 = require("@angular/core");
var Rx_1 = require("rxjs/Rx");
/**
 *
 *
 * @export
 * @class Adal5Service
 */
var Adal5Service = /** @class */ (function () {
    /**
     * Creates an instance of Adal5Service.
     *
     * @memberOf Adal5Service
     */
    function Adal5Service() {
        /**
         *
         *
         * @private
         * @type {Adal5User}
         * @memberOf Adal5Service
         */
        this.adal5User = {
            authenticated: false,
            username: '',
            error: '',
            token: '',
            profile: {},
            loginCached: false
        };
    }
    /**
     *
     *
     * @param {adal.Config} configOptions
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.init = function (configOptions) {
        if (!configOptions) {
            throw new Error('You must set config, when calling init.');
        }
        // redirect and logout_redirect are set to current location by default
        var existingHash = window.location.hash;
        var pathDefault = window.location.href;
        if (existingHash) {
            pathDefault = pathDefault.replace(existingHash, '');
        }
        configOptions.redirectUri = configOptions.redirectUri || pathDefault;
        configOptions.postLogoutRedirectUri = configOptions.postLogoutRedirectUri || pathDefault;
        this.doRefresh = configOptions.doRefresh || Promise.resolve(true);
        // create instance with given config
        this.adalContext = adalLib.inject(configOptions);
        window.AuthenticationContext = this.adalContext.constructor;
        // loginresource is used to set authenticated status
        this.updateDataFromCache(this.adalContext.config.loginResource);
        if (this.adal5User.loginCached && !this.adal5User.authenticated && window.self == window.top && !this.isInCallbackRedirectMode) {
            this.doRefresh = function () { return Promise.resolve(true); };
            this.refreshLoginToken();
        }
        else if (this.adal5User.loginCached && this.adal5User.authenticated && !this.loginRefreshTimer && window.self == window.top) {
            this.setupLoginTokenRefreshTimer();
        }
    };
    Object.defineProperty(Adal5Service.prototype, "config", {
        /**
         *
         *
         * @readonly
         * @type {adal.Config}
         * @memberOf Adal5Service
         */
        get: function () {
            return this.adalContext.config;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Adal5Service.prototype, "userInfo", {
        /**
         *
         *
         * @readonly
         * @type {Adal5User}
         * @memberOf Adal5Service
         */
        get: function () {
            return this.adal5User;
        },
        enumerable: true,
        configurable: true
    });
    /**
     *
     *
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.login = function () {
        this.adalContext.login();
    };
    /**
     *
     *
     * @returns {boolean}
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.loginInProgress = function () {
        return this.adalContext.loginInProgress();
    };
    /**
     *
     *
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.logOut = function () {
        this.adalContext.logOut();
    };
    /**
     *
     *
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.handleWindowCallback = function () {
        var hash = window.location.hash;
        if (this.adalContext.isCallback(hash)) {
            var requestInfo = this.adalContext.getRequestInfo(hash);
            this.adalContext.saveTokenFromHash(requestInfo);
            if (requestInfo.requestType === this.adalContext.REQUEST_TYPE.LOGIN) {
                this.updateDataFromCache(this.adalContext.config.loginResource);
                this.setupLoginTokenRefreshTimer();
            }
            else if (requestInfo.requestType === this.adalContext.REQUEST_TYPE.RENEW_TOKEN) {
                this.adalContext.callback = window.parent.callBackMappedToRenewStates[requestInfo.stateResponse];
            }
            if (requestInfo.stateMatch) {
                if (typeof this.adalContext.callback === 'function') {
                    if (requestInfo.requestType === this.adalContext.REQUEST_TYPE.RENEW_TOKEN) {
                        // Idtoken or Accestoken can be renewed
                        if (requestInfo.parameters['access_token']) {
                            this.adalContext.callback(this.adalContext._getItem(this.adalContext.CONSTANTS.STORAGE.ERROR_DESCRIPTION), requestInfo.parameters['access_token']);
                        }
                        else if (requestInfo.parameters['error']) {
                            this.adalContext.callback(this.adalContext._getItem(this.adalContext.CONSTANTS.STORAGE.ERROR_DESCRIPTION), null);
                            this.adalContext._renewFailed = true;
                        }
                    }
                }
            }
        }
        // Remove hash from url
        if (window.location.hash) {
            window.location.href = window.location.href.replace(window.location.hash, '');
        }
    };
    /**
     *
     *
     * @param {string} resource
     * @returns {string}
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.getCachedToken = function (resource) {
        return this.adalContext.getCachedToken(resource);
    };
    /**
     *
     *
     * @param {string} resource
     * @returns
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.acquireToken = function (resource) {
        var _this = this; // save outer this for inner function
        var errorMessage;
        return Rx_1.Observable.bindCallback(acquireTokenInternal, function (token) {
            if (!token && errorMessage) {
                throw (errorMessage);
            }
            return token;
        })();
        function acquireTokenInternal(cb) {
            var s = null;
            _this.adalContext.acquireToken(resource, function (error, tokenOut) {
                if (error) {
                    _this.adalContext.error('Error when acquiring token for resource: ' + resource, error);
                    errorMessage = error;
                    cb(null);
                }
                else {
                    cb(tokenOut);
                    s = tokenOut;
                }
            });
            return s;
        }
    };
    /**
     *
     *
     * @returns {Observable<adal.User>}
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.getUser = function () {
        var _this_1 = this;
        return Rx_1.Observable.bindCallback(function (cb) {
            _this_1.adalContext.getUser(function (error, user) {
                if (error) {
                    this.adalContext.error('Error when getting user', error);
                    cb(null);
                }
                else {
                    cb(user);
                }
            });
        })();
    };
    /**
     *
     *
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.clearCache = function () {
        this.adalContext.clearCache();
    };
    /**
     *
     *
     * @param {string} resource
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.clearCacheForResource = function (resource) {
        this.adalContext.clearCacheForResource(resource);
    };
    /**
     *
     *
     * @param {string} message
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.info = function (message) {
        this.adalContext.info(message);
    };
    /**
     *
     *
     * @param {string} message
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.verbose = function (message) {
        this.adalContext.verbose(message);
    };
    /**
     *
     *
     * @param {string} url
     * @returns {string}
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.getResourceForEndpoint = function (url) {
        return this.adalContext.getResourceForEndpoint(url);
    };
    /**
     *
     *
     * @returns {string}
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.getToken = function () {
        if (this.adalContext) {
            return this.adalContext._getItem(this.adalContext.CONSTANTS.STORAGE.ACCESS_TOKEN_KEY + this.adalContext.config.loginResource);
        }
        else {
            this.adal5User.token;
        }
    };
    /**
     *
     *
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.refreshDataFromCache = function () {
        this.updateDataFromCache(this.adalContext.config.loginResource);
    };
    /**
     *
     *
     * @private
     * @param {string} resource
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.updateDataFromCache = function (resource) {
        var token = this.adalContext.getCachedToken(resource);
        this.adal5User.authenticated = token !== null && token.length > 0;
        var user = this.adalContext.getCachedUser() || { userName: '', profile: undefined };
        if (user) {
            this.adal5User.username = user.userName;
            this.adal5User.profile = user.profile;
            this.adal5User.token = token;
            this.adal5User.error = this.adalContext.getLoginError();
            this.adal5User.loginCached = true;
        }
        else {
            this.adal5User.username = '';
            this.adal5User.profile = {};
            this.adal5User.token = '';
            this.adal5User.error = '';
            this.adal5User.loginCached = false;
        }
    };
    ;
    /**
     *
     *
     *
     * @memberOf Adal5Service
     */
    Adal5Service.prototype.refreshLoginToken = function () {
        var _this_1 = this;
        if (!this.adal5User.loginCached) {
            throw ('User not logged in');
        }
        this.doRefresh().then(function (shouldProlong) {
            if (shouldProlong) {
                _this_1.acquireToken(_this_1.adalContext.config.loginResource).subscribe(function (token) {
                    _this_1.adal5User.token = token;
                    _this_1.userInfo.token = token;
                    if (!_this_1.adal5User.authenticated) {
                        // refresh the page
                        window.location.reload();
                    }
                    else {
                        _this_1.setupLoginTokenRefreshTimer();
                    }
                }, function (error) {
                    _this_1.rejectProlong();
                });
            }
            else {
                _this_1.rejectProlong();
            }
        }).catch(function () {
        });
    };
    Adal5Service.prototype.rejectProlong = function () {
        this.adal5User.authenticated = false;
        this.adal5User.error = this.adalContext.getLoginError();
    };
    Adal5Service.prototype.now = function () {
        return Math.round(new Date().getTime() / 1000.0);
    };
    Object.defineProperty(Adal5Service.prototype, "isInCallbackRedirectMode", {
        get: function () {
            return window.location.href.indexOf('#access_token') !== -1 || window.location.href.indexOf('#id_token') !== -1;
        },
        enumerable: true,
        configurable: true
    });
    ;
    Adal5Service.prototype.setupLoginTokenRefreshTimer = function () {
        var _this_1 = this;
        // Get expiration of login token
        var exp = this.adalContext._getItem(this.adalContext.CONSTANTS.STORAGE.EXPIRATION_KEY + this.adalContext.config.loginResource);
        // Either wait until the refresh window is valid or refresh in 1 second (measured in seconds)
        var timerDelay = exp - this.now() - (this.adalContext.config.expireOffsetSeconds || 300) > 0 ? exp - this.now() - (this.adalContext.config.expireOffsetSeconds || 300) : 1;
        if (this.loginRefreshTimer) {
            this.loginRefreshTimer.unsubscribe();
        }
        this.loginRefreshTimer = Rx_1.Observable.timer(timerDelay * 1000)
            .take(1)
            .subscribe(function (x) {
            _this_1.refreshLoginToken();
        });
    };
    Adal5Service = __decorate([
        core_1.Injectable()
    ], Adal5Service);
    return Adal5Service;
}());
exports.Adal5Service = Adal5Service;
