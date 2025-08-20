import Nprogress from 'nprogress'
import filePicker from 'file-picker'
import Upload from 'upload'
import * as viewManage from './viewManage'
import {onNavigate, onLaunch, onBack} from './service'
import header from './header'
import throttle from 'throttleit'
import record from './sdk/record'
import Compass from './sdk/compass'
import storage from './sdk/storage'
import Picker from './sdk/picker'
import TimePicker from './sdk/timePicker'
import DatePicker from './sdk/datePicker'
import * as fileList from './sdk/fileList'
import toast from './sdk/toast'
import image from './sdk/image'
import modal from './sdk/modal'
import actionSheet from './sdk/actionsheet'
import {once} from './event'
import Preview from './component/preview'
import confirm from './component/confirm'
import Toast from './component/toast'
import mask from './component/mask'
import qrscan from './component/qrscan'
import {getRedirectData, validPath, dataURItoBlob, toNumber,getBus} from '../lib/util'
const Bus = getBus()

let fileIndex = 0
let fileStore = {}


function toAppService(data) {
  data.to = 'appservice'
  let obj = Object.assign({
    command: 'MSG_FROM_WEBVIEW',
    webviewID: SERVICE_ID
  }, data)
  if (obj.msg && obj.command !== 'GET_ASSDK_RES') {
    let view = currentView()
    let id = view ? view.id : 0
    obj.msg.webviewID = data.webviewID || id
    obj.msg.options = obj.msg.options || {}
    obj.msg.options.timestamp = Date.now()
  }
  if (obj.command == 'GET_ASSDK_RES'){
    ServiceJSBridge.invokeCallbackHandler(obj.ext.callbackID, obj.msg);
  }else if(obj.command == 'MSG_FROM_WEBVIEW'){
    ServiceJSBridge.subscribeHandler(obj.msg.eventName,obj.msg.data || {},obj.msg.webviewID)
  }
}
export function getPublicLibVersion() {
  //ignore
}

export function systemLog() {
  //ignore
}

export function shareAppMessage(data) {
  let {desc, imgUrl, path, title} = data.args
  modal({
    title,
    imgUrl,
    content: desc
  }).then(confirm => {
    onSuccess(data, { confirm })
  })
}

export function requestPayment(data) {
  confirm('确认支付吗？').then(() => {
    onSuccess(data, {statusCode: 200})
  }, () => {
    onError(data)
  })
}

export function previewImage(data) {
  let args = data.args
  let urls = args.urls
  let current = args.current
  let preview = new Preview(urls, {})
  preview.show()
  preview.active(current)
  onSuccess(data)
}

export function PULLDOWN_REFRESH(data) {
  toAppService({
    msg: {
      data: {},
      eventName: "onPullDownRefresh",
      webviewID: data.webviewID
    }
  })
}

export function stopPullDownRefresh(data) {
  let curr = viewManage.currentView()
  if (curr) {
    curr.postMessage({
      command: "STOP_PULL_DOWN_REFRESH"
    })
  }
  data.sdkName = 'stopPullDownRefresh'
  onSuccess(data)
}

// publish event to views
export function publish(data) {
  let all_ids = viewManage.getViewIds()
  let ids = toNumber(data.webviewIds) || all_ids
  data.act = 'sendMsgFromAppService'
  let obj = {
    msg: data,
    command: 'MSG_FROM_APPSERVICE'
  }
  viewManage.eachView(view => {
    if (ids.indexOf(view.id) !== -1) {
      view.postMessage(obj)
    }
  })
}

export function scanCode(data) {
  qrscan().then(val => {
    onSuccess(data, {
      result: val
    })
  }, () => {
    onCancel(data)
  })
}

export function WEBVIEW_READY (data) {
  console.log(data)
}


//页面滚动API
export function pageScrollTo (param) {
    var scrollable = document.querySelector(".scrollable"), scrollTop = param.args.scrollTop;
    if (void 0 !== scrollTop) {
        scrollTop< 0 && (scrollTop = 0);
        var clientHeight = getWindowHeight(), scrollHeight = getScrollHeight();
        scrollTop > scrollHeight - clientHeight && (scrollTop = scrollHeight - clientHeight);
        var init = function() {
            scrollable.style.transition = "";
            scrollable.style.webkitTransition = "";
            scrollable.style.transform = "";
            scrollable.style.webkitTransform = "";
            scrollable.scrollTop = scrollTop;
            scrollable.removeEventListener("transitionend", param);
            scrollable.removeEventListener("webkitTransitionEnd", param);
        },
            l = "translateY(" + (scrollable.scrollTop - scrollTop) + "px) translateZ(0)";
        scrollable.style.transition = "transform .3s ease-out";
        scrollable.style.webkitTransition = "-webkit-transform .3s ease-out";
        scrollable.addEventListener("transitionend", init);
        scrollable.addEventListener("webkitTransitionEnd", init);
        scrollable.style.transform = l;
        scrollable.style.webkitTransform = l;
        scrollable.style.scrollTop = scrollTop;
    }
}


export function GET_APP_STORAGE(data) {
  let res = storage.getAll()
  window.postMessage({
    to: data.comefrom,
    msg: {
      storage: res
    },
    command: 'SET_APP_STORAGE'
  }, '*')
}

export function DELETE_APP_STORAGE(data) {
  if (!data.data || !data.data.key) return console.error('key not found')
  storage.remove(data.data.key)
}

export function SET_APP_STORAGE(data) {
  let d = data.data
  if (!d || !d.key || !d.type)  return console.error('wrong arguments')
  storage.set(d.key, d.value, d.type)
}

storage.on('change', () => {
  let res = storage.getAll()
  window.postMessage({
    to: 'devtools-storage',
    msg: {
      storage: res
    },
    command: 'SET_APP_STORAGE'
  }, '*')
})


export function setNavigationBarTitle(data) {
  let title = data.args.title
  if (title) header.setTitle(title)
}

export function setStatusBarStyle(data) {
  let color = data.args.color
  if (color) header.setState({color: color})
}

export function setNavigationBarColor(data) {
  let styles = data.args
  if (styles) header.setNavigationBarColor(styles)
}

export function showNavigationBarLoading() {
  header.showLoading()
}

export function hideNavigationBarLoading() {
  header.hideLoading()
}

export function chooseImage(data) {
  let URL = (window.URL || window.webkitURL)
  filePicker({ multiple: true, accept: 'image/*' }, files => {
    files = [].slice.call(files)
    let paths = files.map(file => {
      let blob = URL.createObjectURL(file)
      fileStore[blob] = file
      return blob
    })
    onSuccess(data, { tempFilePaths: paths })
  })
}

export function chooseVideo(data) {
  let URL = (window.URL || window.webkitURL)
  filePicker({accept: 'video/*' }, files => {
    let path = URL.createObjectURL(files[0])
    fileStore[path] = files[0]
    let video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = function () {
      let duration = video.duration
      let size = files[0].size
      onSuccess(data, {
        duration,
        size,
        height: video.videoHeight,
        width: video.videoWidth,
        tempFilePath: path
      })
    }
    video.src =  path
  })
}

export function saveFile(data) {
  let blob = data.args.tempFilePath
  if (!blob) return onError(data, 'file path required')
  let file = fileStore[blob]
  if (!file) return onError(data, 'file not found')
  let upload = new Upload(file)
  upload.to('/upload')
  upload.on('end', xhr => {
    if (xhr.status / 100 | 0 == 2) {
      let result = JSON.parse(xhr.responseText)
      onSuccess(data, {
        statusCode: xhr.status,
        savedFilePath: result.file_path
      })
    } else {
      onError(data, `request error ${xhr.status}`)
    }
  })
  upload.on('error', err => {
    onError(data, err.message)
  })
}

export function enableCompass() {
  let id = Compass.watch(throttle(head => {
    toAppService({
      msg: {
        eventName: 'onCompassChange',
        type: 'ON_APPLIFECYCLE_EVENT',
        data: {
          direction: head
        }
      }
    })
  }, 200))
  viewManage.currentView().on('destroy', () => {
    Compass.unwatch(id)
  })
}

export function enableAccelerometer() {
  if(window.DeviceMotionEvent){
    let handler = throttle(event => {
      let {x, y, z} = {
        x: event.accelerationIncludingGravity.x,
        y: event.accelerationIncludingGravity.y,
        z: event.accelerationIncludingGravity.z
      }
      if (x == null || y == null || z == null) return
      toAppService({
        msg: {
          eventName: 'onAccelerometerChange',
          type: 'ON_APPLIFECYCLE_EVENT',
          data: {x, y, z}
        }
      })
    }, 200)
    window.addEventListener("devicemotion", handler, false);
    viewManage.currentView().on('destroy', () => {
      window.removeEventListener("devicemotion", handler, false);
    })
  } else {
    console.warn("DeviceMotionEvent is not supported");
  }
}

export function getNetworkType(data) {
  let type = navigator.connection == null ? 'WIFI' : navigator.connection.type
  onSuccess(data, {
    networkType: type
  })
}

export function getLocation(data) {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(position => {
      let coords = position.coords
      onSuccess(data, {
        longitude: coords.longitude,
        latitude: coords.latitude
      })
    })
  } else {
    onError(data, {
      message: 'geolocation not supported'
    })
  }
}

export function openLocation(data) {
  let args = data.args
  let url = "http://apis.map.qq.com/tools/poimarker?type=0&marker=coord:" + args.latitude + "," + args.longitude + "&key=JMRBZ-R4HCD-X674O-PXLN4-B7CLH-42BSB&referer=wxdevtools"
  viewManage.openExternal(url)
  Nprogress.done()
  onSuccess(data, {
    latitude: args.latitude,
    longitude: args.longitude
  })
}

export function chooseLocation(data) {
  let url = `https://3gimg.qq.com/lightmap/components/locationPicker2/index.html?search=1&type=1&coord=39.90403%2C116.407526&key=JMRBZ-R4HCD-X674O-PXLN4-B7CLH-42BSB&referer=wxdevtools`
  viewManage.openExternal(url)
  Nprogress.done()
  let called = false
  Bus.once('back',() => {
    if (!called) {
      called = true
      onCancel(data)
    }
  })
  Bus.once('location', location => {
    if (!called) {
      called = true
      if (location) {
        onSuccess(data, location)
      } else {
        onCancel(data)
      }
    }
  })
}

export function setStorage(data) {
  let args = data.args
  storage.set(args.key, args.data, args.dataType)
  if (args.key == null || args.key == '') {
    return onError(data, 'key required')
  }
  onSuccess(data)
}

export function getStorage(data) {
  let args = data.args
  if (args.key == null || args.key == '') {
    return onError(data, 'key required')
  }
  let res = storage.get(args.key)
  onSuccess(data, {
    data: res.data,
    dataType: res.dataType
  })
}

export function clearStorage(data) {
  storage.clear()
  onSuccess(data)
}

export function startRecord(data) {
  record.startRecord({
    success: url => {
      onSuccess(data, {
        tempFilePath: url
      })
    },
    fail: err => {
      return onError(data, err.message)
    }
  }).catch((e) => {
    console.warn(`Audio record failed: ${e.message}`)
  })
}

export function stopRecord() {

    record.stopRecord().then(blob => {
        let filename = `audio${fileIndex}`
        fileIndex++
        let file = new File([blob], filename, {type: 'audio/x-wav', lastModified: Date.now()});
        fileStore[blob] = file
    })
}

export function playVoice(data) {
  let url = data.args.filePath
  let audio = document.getElementById("audio");
  if (audio.src == url && audio.paused && !audio.ended) {
    // resume
    audio.play()
  } else {
    audio.src = url
    audio.load()
    audio.play()
    once(audio, 'error', e => {
      onError(data, e.message)
    })
    once(audio, 'ended', () => {
      onSuccess(data)
    })
  }
}

export function pauseVoice() {
  let audio = document.getElementById("audio");
  audio.pause()
}

export function stopVoice() {
  let audio = document.getElementById("audio");
  audio.pause()
  audio.currentTime = 0
  audio.src = ''
}

window.addEventListener('DOMContentLoaded', function () {
  let audio = document.getElementById("background-audio");
  audio.addEventListener('error', function () {
    toAppService({
      msg: {
        eventName: 'onMusicError',
        type: 'ON_MUSIC_EVENT'
      }
    })
  }, false)
}, false)

export function getMusicPlayerState(data) {
  let a = document.getElementById("background-audio");
  let obj = {
    status: a.src ? a.paused ? 0 : 1 : 2,
    currentPosition: Math.floor(a.currentTime) || -1
  }
  if (a.src && !a.paused) {
    obj.duration = a.duration || 0
    try {
      obj.downloadPercent = Math.round(100*a.buffered.end(0)/a.duration)
    } catch(e) {
    }
    obj.dataUrl = a.currentSrc
  }
  onSuccess(data, obj)
}

export function operateMusicPlayer(data) {
  let args = data.args
  let a = document.getElementById("background-audio");
  switch (args.operationType) {
    case 'play':
      if (a.src == args.dataUrl && a.paused && !a.ended) {
        a.play()
      } else {
        a.src = args.dataUrl
        a.load()
        a.loop = true
        a.play()
      }
      toAppService({
        msg: {
          eventName: 'onMusicPlay',
          type: 'ON_MUSIC_EVENT'
        }
      })
      break
    case 'pause':
      a.pause()
      toAppService({
        msg: {
          eventName: 'onMusicPause',
          type: 'ON_MUSIC_EVENT'
        }
      })
      break
    case 'seek':
      a.currentTime = args.position
      break
    case 'stop':
      a.pause()
      a.currentTime = 0
      a.src = ''
      toAppService({
        msg: {
          eventName: 'onMusicEnd',
          type: 'ON_MUSIC_EVENT'
        }
      })
      break
  }
  onSuccess(data)
}

export function uploadFile(data) {
  let args = data.args
  if (!args.filePath || !args.url || !args.name) {
    return onError(data, 'filePath, url and name required')
  }
  let file = fileStore[args.filePath]
  if (!file) return onError(data, `${args.filePath} not found`)

  let headers = args.header || {}
  if (headers.Referer || headers.rederer) {
    console.warn('请注意，微信官方不允许设置请求 Referer')
  }
  let formData = args.formData || {}
  let xhr = new XMLHttpRequest()
  xhr.open('POST', '/remoteProxy')
  xhr.onload = function () {
    if (xhr.status / 100 | 0 == 2) {
      onSuccess(data, {statusCode: xhr.status, data: xhr.responseText})
    } else {
      onError(data, `request error ${xhr.status}`)
    }
  }
  xhr.onerror = function (e) {
    onError(data, `request error ${e.message}`)
  }
  let key
  for (key in headers) {
    xhr.setRequestHeader(key, headers[key]);
  }
  xhr.setRequestHeader('X-Remote', args.url);
  let body = new FormData
  body.append(args.name, file)
  for (key in formData) {
    body.append(key, formData[key])
  }
  xhr.send(body)
}

export function downloadFile(data) {
  let URL = (window.URL || window.webkitURL)
  let args = data.args
  if (!args.url) return onError(data, 'url required')
  let xhr = new XMLHttpRequest()
  xhr.responseType = 'arraybuffer'
  let headers = args.header || {}
  xhr.open('GET', '/remoteProxy?' + encodeURIComponent(args.url), true)
  xhr.onload = function () {
    if (xhr.status / 100 | 0 == 2 || xhr.status == 304) {
      let b = new Blob([xhr.response], {type: xhr.getResponseHeader("Content-Type")});
      let blob = URL.createObjectURL(b)
      fileStore[blob] = b
      onSuccess(data, {
        statusCode: xhr.status,
        tempFilePath: blob
      })
    } else {
      onError(data, `request error ${xhr.status}`)
    }
  }
  xhr.onerror = function (e) {
    onError(data, `request error ${e.message}`)
  }
  let key
  for (key in headers) {
    xhr.setRequestHeader(key, headers[key]);
  }
  xhr.setRequestHeader('X-Remote', args.url);
  xhr.send(null)
}

export function getSavedFileList(data) {
  fileList.getFileList().then(list => {
    onSuccess(data, {
      fileList: list
    })
  }, err => {
    onError(data, err.message)
  })
}

export function removeSavedFile(data) {
  let args = data.args
  if (requiredArgs(['filePath'], data)) return
  fileList.removeFile(args.filePath).then(() => {
    onSuccess(data, {})
  }, err => {
    onError(data, err.message)
  })
}

export function getSavedFileInfo(data) {
  let args = data.args
  if (requiredArgs(['filePath'], data)) return
  fileList.getFileInfo(args.filePath).then(info => {
    onSuccess(data, info)
  }, err => {
    onError(data, err.message)
  })
}

export function openDocument(data) {
  let args = data.args
  if (requiredArgs(['filePath'], data)) return
  console.warn('没有判定文件格式，返回为模拟返回')
  onSuccess(data)
  confirm(`<div>openDocument</div> ${args.filePath}`, true).then(() => {
  }, () => {
  })
}

export function getStorageInfo(data) {
  let info = storage.info()
  onSuccess(data, info)
}

export function removeStorage(data) {
  let args = data.args
  if (requiredArgs(['key'], data)) return

  let o = storage.remove(args.key)
  onSuccess(data, {data: o})
}

export function showToast(data) {
  if (requiredArgs(['title'], data)) return
  toast.show(data.args)
  onSuccess(data)
}

export function hideToast(data) {
  toast.hide()
  onSuccess(data)
}

export function showModal(data) {
  if (requiredArgs(['title', 'content'], data)) return
  modal(data.args).then(confirm => {
    onSuccess(data, { confirm })
  })
}

export function showActionSheet(data) {
  let args = data.args
  if (requiredArgs(['itemList'], data)) return
  if (!Array.isArray(args.itemList)) return onError(data, 'itemList must be Array')
  args.itemList = args.itemList.slice(0, 6)
  actionSheet(args).then(res => {
    onSuccess(data, res)
  })
}

export function getImageInfo(data) {
  if (requiredArgs(['src'], data)) return
  image(data.args.src).then(res => {
    onSuccess(data, res)
  }, err => {
    onError(data, err.message)
  })
}

export function base64ToTempFilePath(data) {
  let uri = data.args.base64Data
  // args.canvasId
  onSuccess(data, {
    filePath: dataURItoBlob(uri)
  })
}

export function refreshSession(data) {
  onSuccess(data)
}

export function showPickerView(data, args) {
  const picker = new Picker(args)
  picker.show()
  //picker.on('cancel', () => {})
  picker.on('select', n => {
    publishPagEevent('bindPickerChange', {
      type: 'change',
      detail: {
        value: n + ''
      }
    })
  })
}

export function showDatePickerView(data, args) {
  let picker
  let eventName
  if (args.mode == 'time') {
    eventName = 'bindTimeChange'
    picker = new TimePicker(args)
  } else {
    eventName = 'bindDateChange'
    picker = new DatePicker(args)
  }
  picker.show()
  picker.on('select', val => {
    publishPagEevent(eventName, {
      type: 'change',
      detail: {
        value: val
      }
    })
  })
}

function requiredArgs(keys, data) {
  let args = data.args
  for (var i = 0, l = keys.length; i < l; i++) {
    if (!args.hasOwnProperty(keys[i])) {
      onError(data, `key ${keys[i]} required for ${data.sdkName}`)
      return true
    }
  }
  return false
}

function onError(data, message) {
  let obj = {
    command: "GET_ASSDK_RES",
    ext: Object.assign({}, data),
    msg: {
      errMsg: `${data.sdkName}:fail`
    }
  }
  if (message) obj.msg.message = message
  toAppService(obj)
}

function onSuccess(data, extra = {}) {
  if (!data.sdkName) throw new Error('sdkName not found')
  let obj = {
    command: "GET_ASSDK_RES",
    ext: Object.assign({}, data),
    msg: {
      errMsg: `${data.sdkName}:ok`
    }
  }
  obj.msg = Object.assign(obj.msg, extra)
  toAppService(obj)
}

function onCancel(data, extra = {}) {
  let obj = {
    command: "GET_ASSDK_RES",
    ext: Object.assign({}, data),
    msg: {
      errMsg: `${data.sdkName}:cancel`
    }
  }
  obj.msg = Object.assign(obj.msg, extra)
  toAppService(obj)
}

function publishPagEevent(eventName, extra) {
  let obj = {
    command: 'MSG_FROM_WEBVIEW',
    msg: {
      data: {
        data: {
          data: extra,
          eventName
        }
      },
      eventName: 'custom_event_PAGE_EVENT',
    }
  }
  toAppService(obj)
}

function getWindowHeight () {
  var scrollable = document.querySelector(".scrollable");
    return  scrollable.clientHeight;
}
function getScrollHeight (){
    var e = 0, t = 0;
    var scrollable = document.querySelector(".scrollable");
    return scrollable && (e = scrollable.scrollHeight);
}
function checkScrollBottom(){
    var t = o - window.scrollY <= 0;
    return o = window.scrollY, !!(window.scrollY + n() + e >= i() && t)
}
var a = !1,
    s =  !0;
function triggerPullUpRefresh (){
    s && !a && (wx.publishPageEvent("onReachBottom", {}), s = !1, setTimeout(function () {
        s = !0
    }, 350))
}