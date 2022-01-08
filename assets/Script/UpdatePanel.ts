// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const {ccclass, property} = cc._decorator;

@ccclass
export default class UpdatePanel extends cc.Component {

    @property(cc.Label)
    info: cc.Label = null;

    @property(cc.ProgressBar)
    fileProgress: cc.ProgressBar = null;

    @property(cc.Label)
    fileLabel: cc.Label = null;
    @property(cc.ProgressBar)
    byteProgress: cc.ProgressBar = null;

    @property(cc.Label)
    byteLabel: cc.Label = null;

    @property(cc.Node)
    close: cc.Node = null;

    @property(cc.Node)
    checkBtn: cc.Node = null;

    @property(cc.Node)
    retryBtn: cc.Node = null;

    @property(cc.Node)
    updateBtn: cc.Node = null;


    start () {

    }

    // update (dt) {}
}
