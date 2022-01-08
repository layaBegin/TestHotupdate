
import UpdatePanel from "./UpdatePanel"

const {ccclass, property} = cc._decorator;

@ccclass
export default class HotUpdate extends cc.Component {



    @property(UpdatePanel)
    panel: UpdatePanel = null;

    @property({type:cc.Asset})
    manifestUrl: cc.Asset = null;

    @property(cc.Node)
    updateUI: cc.Node = null;

    private _updating = false;
    private _canRetry = false;
    private _storagePath = '';
    private _am: jsb.AssetsManager = null;
    private _checkListener = null;
    private _updateListener = null;
    private _failCount = 0;
    private versionCompareHandle: (versionA: string, versionB: string) => number = null;


    // use this for initialization
    onLoad() {
        // Hot update is only available in Native build
        if (!jsb) {
            return;
        }
        this._storagePath = ((jsb.fileUtils ? jsb.fileUtils.getWritablePath() : '/') + 'blackjack-remote-asset');
        console.log('==Storage path for remote asset : ' + this._storagePath);

        // Setup your own version compare handler, versionA and B is versions in string
        // if the return value greater than 0, versionA is greater than B,
        // if the return value equals 0, versionA equals to B,
        // if the return value smaller than 0, versionA is smaller than B.
        this.versionCompareHandle = function (versionA: string, versionB: string) {
            console.log("JS Custom Version Compare: version A is " + versionA + ', version B is ' + versionB);
            var vA = versionA.split('.');
            var vB = versionB.split('.');
            for (var i = 0; i < vA.length; ++i) {
                var a = parseInt(vA[i]);
                var b = parseInt(vB[i] || '0');
                if (a === b) {
                    continue;
                }
                else {
                    return a - b;
                }
            }
            if (vB.length > vA.length) {
                return -1;
            }
            else {
                return 0;
            }
        };

        // Init with empty manifest url for testing custom manifest
        this._am = new jsb.AssetsManager('', this._storagePath, this.versionCompareHandle);

        var panel = this.panel;
        // Setup the verification callback, but we don't have md5 check function yet, so only print some message
        // Return true if the verification passed, otherwise return false
        this._am.setVerifyCallback(function (path: string, asset: any) {
            // When asset is compressed, we don't need to check its md5, because zip file have been deleted.
            var compressed = asset.compressed;
            // Retrieve the correct md5 value.
            var expectedMD5 = asset.md5;
            // asset.path is relative path and path is absolute.
            var relativePath = asset.path;
            // The size of asset file, but this value could be absent.
            var size = asset.size;
            if (compressed) {
                panel.info.string = "Verification passed : " + relativePath;
                return true;
            }
            else {
                panel.info.string = "Verification passed : " + relativePath + ' (' + expectedMD5 + ')';
                return true;
            }
        });

        this.panel.info.string = 'Hot update is ready, please check or directly update.';
        this.panel.fileProgress.progress = 0;
        this.panel.byteProgress.progress = 0;
    }

    checkCb(event: any) {
        console.log('Code: ' + event.getEventCode());
        switch (event.getEventCode()) {
            case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                this.panel.info.string = "No local manifest file found, hot update skipped.";
                break;
            case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
            case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
                this.panel.info.string = "Fail to download manifest file, hot update skipped.";
                break;
            case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                this.panel.info.string = "Already up to date with the latest remote version.";
                break;
            case jsb.EventAssetsManager.NEW_VERSION_FOUND:
                this.panel.info.string = 'New version found, please try to update. (' + Math.ceil(this._am.getTotalBytes() / 1024) + 'kb)';
                this.panel.checkBtn.active = false;
                this.panel.fileProgress.progress = 0;
                this.panel.byteProgress.progress = 0;
                break;
            default:
                return;
        }


        this._am.setEventCallback(null!);
        this._checkListener = null;
        this._updating = false;
    }


    updateCb(event: any) {
        var needRestart = false;
        var failed = false;
        switch (event.getEventCode()) {
            case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                this.panel.info.string = 'No local manifest file found, hot update skipped.';
                failed = true;
                break;
            case jsb.EventAssetsManager.UPDATE_PROGRESSION:
                this.panel.byteProgress.progress = event.getPercent();
                this.panel.fileProgress.progress = event.getPercentByFile();

                this.panel.fileLabel.string = event.getDownloadedFiles() + ' / ' + event.getTotalFiles();
                this.panel.byteLabel.string = event.getDownloadedBytes() + ' / ' + event.getTotalBytes();
                console.log(this.panel.fileLabel.string, this.panel.byteLabel.string);
                var msg = event.getMessage();
                if (msg) {
                    this.panel.info.string = 'Updated file: ' + msg;
                    // cc.log(event.getPercent()/100 + '% : ' + msg);
                }
                break;
            case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
            case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
                this.panel.info.string = 'Fail to download manifest file, hot update skipped.';
                failed = true;
                break;
            case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                this.panel.info.string = 'Already up to date with the latest remote version.';
                failed = true;
                break;
            case jsb.EventAssetsManager.UPDATE_FINISHED:
                this.panel.info.string = 'Update finished. ' + event.getMessage();
                needRestart = true;
                break;
            case jsb.EventAssetsManager.UPDATE_FAILED:
                this.panel.info.string = 'Update failed. ' + event.getMessage();
                this.panel.retryBtn.active = true;
                this._updating = false;
                this._canRetry = true;
                break;
            case jsb.EventAssetsManager.ERROR_UPDATING:
                this.panel.info.string = 'Asset update error: ' + event.getAssetId() + ', ' + event.getMessage();
                break;
            case jsb.EventAssetsManager.ERROR_DECOMPRESS:
                this.panel.info.string = event.getMessage();
                break;
            default:
                break;
        }

        if (failed) {
            this._am.setEventCallback(null!);
            this._updateListener = null;
            this._updating = false;
        }

        if (needRestart) {
            this._am.setEventCallback(null!);
            this._updateListener = null;
            // Prepend the manifest's search path
            var searchPaths = jsb.fileUtils.getSearchPaths();
            var newPaths = this._am.getLocalManifest().getSearchPaths();
            console.log(JSON.stringify(newPaths));
            Array.prototype.unshift.apply(searchPaths, newPaths);
            // This value will be retrieved and appended to the default search path during game startup,
            // please refer to samples/js-tests/main.js for detailed usage.
            // !!! Re-add the search paths in main.js is very important, otherwise, new scripts won't take effect.
            localStorage.setItem('HotUpdateSearchPaths', JSON.stringify(searchPaths));
            jsb.fileUtils.setSearchPaths(searchPaths);

            // restart game.
            setTimeout(() => {
                cc.game.restart();
            }, 1000)
        }
    }

    retry() {
        if (!this._updating && this._canRetry) {
            this.panel.retryBtn.active = false;
            this._canRetry = false;

            this.panel.info.string = 'Retry failed Assets...';
            this._am.downloadFailedAssets();
        }
    }


    checkUpdate() {
        if (this._updating) {
            this.panel.info.string = 'Checking or updating ...';
            return;
        }
        if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
            var url = this.manifestUrl.nativeUrl;
            this._am.loadLocalManifest(url);
        }
        if (!this._am.getLocalManifest() || !this._am.getLocalManifest().isLoaded()) {
            this.panel.info.string = 'Failed to load local manifest ...';
            return;
        }
        this._am.setEventCallback(this.checkCb.bind(this));

        this._am.checkUpdate();
        this._updating = true;
    }


    hotUpdate() {
        if (this._am && !this._updating) {
            this._am.setEventCallback(this.updateCb.bind(this));

            if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
                var url = this.manifestUrl.nativeUrl;
                this._am.loadLocalManifest(url);
            }

            this._failCount = 0;
            this._am.update();
            this.panel.updateBtn.active = false;
            this._updating = true;
        }
    }

    show() {
        if (this.updateUI.active === false) {
            this.updateUI.active = true;
        }
    }




    onDestroy() {
        if (this._updateListener) {
            this._am.setEventCallback(null!);
            this._updateListener = null;
        }
    }
}
