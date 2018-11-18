var screen_width;
var screen_height;
var img;

var use_storage;

chrome.management.getSelf(function (exinfo) {
  if ( exinfo.installType == 'admin' ) {
    use_storage = chrome.storage.managed;
  } else {
      use_storage = chrome.storage.sync;
  }
});
chrome.system.display.getInfo(function (displays) {
  screen_width = displays[0].modes.slice(-1)[0].widthInNativePixels;
  screen_height = displays[0].modes.slice(-1)[0].heightInNativePixels;
  use_storage.get('refresh_time', function(values) {
    if ( ! values.refresh_time ) {
      refresh_time = 15;
    }
    refresh_time = parseInt(values.refresh_time);
    console.log('refreshing every ' + refresh_time + ' minutes');
    chrome.runtime.getPlatformInfo(function (pinfo) {
      if (pinfo.os == 'cros') { // only run on CrOS, other OS is a noop
        chrome.alarms.create('refresh-background', {'when': Date.now()+3000, 'periodInMinutes': refresh_time});
        chrome.alarms.onAlarm.addListener(refresh_background);
      }
    });
  });
});

function dataURLtoBlob(dataURL) {
    var byteString = atob(dataURL.split(',')[1]),
        mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    var blob = new Blob([ia], {type: mimeString});
    return blob;
}

const asPromised = (block) => {
  return new Promise((resolve, reject) => {
    block((...results) => {
      if (chrome.runtime.lastError) {
        reject(chrome.extension.lastError);
      } else {
        resolve(...results);
      }
    });
  });
};

sysGetInfo = function (component) {
  return asPromised((callback) => {
    chrome.system[component].getInfo(callback);
    });
}

entGetInfo = function (item) {
  return asPromised((callback) => {
    if ( typeof chrome.enterprise !== "undefined" ) {
      if ( typeof chrome.enterprise.deviceAttributes !== "undefined" ) {
        if ( typeof chrome.enterprise.deviceAttributes.getDeviceSerialNumber !== "undefined" ) {
          chrome.enterprise.deviceAttributes[item](callback);
        } else { callback('not available'); }
      } else { callback('not available'); }
    } else { callback('not available'); }
  });
}

getIden = function () {
  return asPromised((callback) => {
    chrome.identity.getProfileUserInfo(callback);
  });
}

getLocalStorage = function(item) {
  return asPromised((callback) => {
    chrome.storage.local.get(item, callback);
  });
}

function getLocalIPs(callback) { // thanks to https://stackoverflow.com/a/29514292
    var ips = [];
    var RTCPeerConnection = window.RTCPeerConnection ||
        window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    var pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.onicecandidate = function(e) {
        if (!e.candidate) {
            pc.close();
            callback(ips);
            return;
        }
        var ip = /^candidate:.+ (\S+) \d+ typ/.exec(e.candidate.candidate)[1];
        if (ips.indexOf(ip) == -1 && ip.substring(0, 4) != "100.") // ignore ARC++ IPs
            ips.push(ip);
    };
    pc.createOffer(function(sdp) {
        pc.setLocalDescription(sdp);
    }, function onerror() {});
}

getIPs = function () {
  return asPromised((callback) => {
    getLocalIPs(callback);
  });
}

function getData(callback) {
  data = {};
  console.log(settings.info_text);
  data_needed = settings.info_text.match(/%%[^%]*%%/g);
  mypromises = [ Promise.resolve(false),  // 0 cpu
                 Promise.resolve(false),  // 1 mem
                 Promise.resolve(false),  // 2 storage
                 Promise.resolve(false),  // 3 storage2
                 Promise.resolve(false),  // 4 serial number
                 Promise.resolve(false),  // 5 location
                 Promise.resolve(false),  // 6 asset id
                 Promise.resolve(false),  // 7 directory api id
                 Promise.resolve(false),  // 8 user email
                 Promise.resolve(false),  // 9 ip addressess
                 Promise.resolve(false)   // 10 user login time
                ];
  for (i = 0; i < data_needed.length; i++) {
    if (data_needed[i].startsWith('%%cpu')) {
      mypromises[0] = sysGetInfo('cpu');
    } else if (data_needed[i].startsWith('%%mem')) {
      mypromises[1] = sysGetInfo('memory');
    } else if (data_needed[i].startsWith('%%disk')) {
      mypromises[2] = sysGetInfo('storage');
      mypromises[3] = navigator.storage.estimate();
    } else if (data_needed[i] === '%%serialnumber%%') {
      mypromises[4] = entGetInfo('getDeviceSerialNumber');
    } else if (data_needed[i] === '%%location%%') {
      mypromises[5] = entGetInfo('getDeviceAnnotatedLocation');
    } else if (data_needed[i] === '%%assetid%%') {
      mypromises[6] = entGetInfo('getDeviceAssetId');
    } else if (data_needed[i] === '%%directoryid%%') {
      mypromises[7] = entGetInfo('getDirectoryDeviceId');
    } else if (data_needed[i] === '%%useremail%%') {
      mypromises[8] = getIden();
    } else if (data_needed[i] === '%%ipaddresses%%') {
      mypromises[9] = getIPs();
    } else if (data_needed[i] === '%%userlogintime%%') {
      mypromises[10] = getLocalStorage('start_time');
    } else if (data_needed[i] === '%%osversion%%') {
       var useragent = navigator.userAgent;
       var uaregex = /^.*CrOS .* ([0-9]*\.[0-9]*\.[0-9]*).*$/g;
       var match = uaregex.exec(useragent);
       data.osversion = match[1];
    } else if (data_needed[i] === '%%browserversion%%') {
        var useragent2 = navigator.userAgent;
        var brregex = /^.*Chrome\/([^\s]*).*$/g;
        var match2 = brregex.exec(useragent2);
        data.browserversion = match2[1];
    } else if (data_needed[i] === '%%refreshtime%%') {
      refreshed = new Date();
      data.refreshtime = refreshed.toLocaleString();
    }
  }
  Promise.all(mypromises).then(function(values) {
    console.log(values);
    if (values[0]) {
      data.cpumodel = values[0].modelName;
      data.cpumodel = data.cpumodel.replace(/\([^\)]*\)/g, ""); // remove useless info
      data.cpumodel = data.cpumodel.replace('  ', ' '); // doublespace to single
      data.cpumodel = data.cpumodel.replace(/^ /g, ''); // remove space at start of string
      data.cpumodel = data.cpumodel.replace(/ $/g, ''); // remove space at end of string
      data.cpucores = values[0].numOfProcessors;
      data.cputempc = values[0].temperatures[0];
      data.cputempf = ((values[0].temperatures[0] * ( 9 / 5 )) + 32).toFixed(1);
    }
    if (values[1]) {
      data.memunused = (values[1].availableCapacity/1024/1024/1024).toFixed(2)+'gb';
      data.memtotal = (values[1].capacity/1024/1024/1024).toFixed(2)+'gb';
    }
    if (values[2]) {
      data.disktotal = (values[2][0].capacity/1024/1024/1024).toFixed(2)+'gb';
    }
    if (values[3]) {
      data.diskfree = (values[3].quota/1024/1024/1024).toFixed(2)+'gb';
    }
    if (values[4]) {
      data.serialnumber = values[4];
    }
    if (values[5]) {
      data.location = values[5];
    } else if (values[5] == "") {
      data.location = "Not specified";
    }
    if (values[6]) {
      data.assetid = values[6];
    } else if (values[6] == "") {
      data.assetid = "Not specified";
    }
    if (values[7]) {
      data.directoryid = values[7];
    }
    if (values[8]) {
      data.useremail = values[8].email;
    }
    if (values[9]) {
      data.ipaddresses = values[9].join(", ");
    }
    if (values[10]) {
      if ( ! values[10].start_time ) {
        userloggedin = 'not available';
      } else {
        var userloggedin = new Date(values[10].start_time);
        data.userlogintime = userloggedin.toLocaleString()
      }
    }
    callback();
  });
}

function draw_background() {
  var canvas = document.createElement('canvas');
  canvas.width = screen_width;
  canvas.height = screen_height;
  console.log('db data:');
  console.log(data);
  var ctx = canvas.getContext("2d");
  if ( settings.background_image ) {
    screen_ratio = screen_width / screen_height; // 2400/1600 = 1.5
    img_ratio = img.width / img.height;  // 500/500 = 1.0
    if ( img_ratio < screen_ratio ) { // 1.0 < 1.5
      draw_img_height = screen_height; // 1600
      draw_img_width = Math.floor(draw_img_height * img_ratio);
      draw_img_y_start = 0;
      draw_img_x_start = Math.floor((screen_width - draw_img_width) / 2); // (2400-1600)/2 = 400
    } else { // 1600/2400 = .666 < 1.0
      draw_img_width = screen_width; // 1600
      draw_img_height = Math.floor(draw_img_width / img_ratio); // 1600
      draw_img_x_start = 0;
      draw_img_y_start = Math.floor((screen_height - draw_img_height) / 2); // (2400-1600)/2 = 400
    }
    console.log('img.width: '+img.width);
    console.log('img.height: '+img.height);
    console.log('screen_ratio: '+screen_ratio);
    console.log('img_ratio: '+img_ratio);
    console.log('draw_img_width: '+draw_img_width);
    console.log('draw_img_height: '+draw_img_height);
    console.log('draw_img_x_start: '+draw_img_x_start);
    console.log('draw_img_y_start: '+draw_img_y_start);
    ctx.drawImage(img, draw_img_x_start, draw_img_y_start, draw_img_width, draw_img_height);
  } else {
    console.log('gradient '+settings.background_gradient_color1+'-'+settings.background_gradient_color2);
    ctx.rect(0, 0, canvas.width, canvas.height);
    var grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grd.addColorStop(0, settings.background_gradient_color1);
    grd.addColorStop(1, settings.background_gradient_color2);
    ctx.fillStyle = grd;
    ctx.fill();
  }
  ctx.font = settings.text_size + "px " + settings.text_font;
  ctx.fillStyle = settings.text_color;
  info_text = settings.info_text;
  info_text = info_text.replace(/%%[^%]*%%/gi, function(x) {
    x = x.replace(/%/g, '');
    return data[x];
  });
  var newline_len = settings.text_size + 5;
  var x = 30;
  var y = 30;
  var info_lines = info_text.split('\n');
  longest_indent = 0;
  for (i = 0; i < info_lines.length; i++) {
    length = info_lines[i].indexOf('\t');
    if ( length > longest_indent ) {
      longest_indent = length;
    }
  }
  indent = longest_indent + 5;
  var complete_lines = [];
  longest_line_length = 0;
  textbox_height = 0;
  for (var i = 0; i < info_lines.length; i++) {
    var myline = info_lines[i];
    var myindent_len = indent - myline.indexOf('\t');
    var myindent = new Array(myindent_len).join(' ');
    var thisline = myline.replace('\t', myindent);
    if (thisline.length > longest_line_length) {
      longest_line_length = thisline.length;
    }
    complete_lines.push(thisline);
  }
  textbox_height = newline_len * complete_lines.length;
  textbox_width = longest_line_length * Math.floor((settings.text_size * 0.6));
  switch(settings.info_text_location) {
    case 'top right':
      x = canvas.width - textbox_width - unusable_right_pixels;
      y = unusable_top_pixels;
      break;
    case 'bottom right':
      console.log('canvas.width:'+canvas.width);
      console.log('textbox_width:'+textbox_width)
      x = canvas.width - textbox_width - unusable_right_pixels;
      y = canvas.height - textbox_height - unusable_bottom_pixels;
      break;
    case 'bottom left':
      x = unusable_left_pixels;
      y = canvas.height - textbox_height - unusable_bottom_pixels;
      break;
    default: // top-left
      x = unusable_left_pixels;
      y = unusable_top_pixels;
      break;
  }
  for (var i = 0; i < complete_lines.length; i++) {
    console.log('x:'+x+' y:'+y);
    ctx.fillText(complete_lines[i], x, y);
    y = y + newline_len;
  }
  console.log('drawing...');
  var blob = dataURLtoBlob(ctx.canvas.toDataURL());
  var xhr = new XMLHttpRequest();
  xhr.responseType = 'arraybuffer';
  xhr.open('GET', URL.createObjectURL(blob));
  xhr.onload = function() {
    chrome.wallpaper.setWallpaper({
      data: xhr.response,
      layout: 'CENTER',
      filename: 'crosinfo',
    },
    function () {
      if (chrome.runtime.lastError) {
        console.log('error setting wallpaper, retry');
        refresh_background('previous-error');
      } else {
        console.log('wallpaper set');
      }
    })};
  xhr.send();
};

function refresh_background(alarmname) {
  console.log('refreshing background...');
  settings = {'text_color': 'white',
              'text_font': 'Monospace',
              'text_size': 20,
              'background_gradient_color1': 'darkblue',
              'background_gradient_color2': 'dodgerblue',
              'info_text_location': 'top right',
              'info_text': 'OS:\tChrome %%browserversion%% Platform %%osversion%%\nCPU:\t%%cpumodel%% - %%cpucores%% cores - %%cputempf%% °F\nMemory:\t%%memunused%% unused of %%memtotal%% total\nStorage:\t%%diskfree%% free of %%disktotal%% total\nUser:\t%%useremail%%\nIP Addresses:\t%%ipaddresses%%\nUser Logged In:\t%%userlogintime%%\n%%ifmanaged%%Serial Number:\t%%serialnumber%%\nLocation:\t%%location%%\nAsset ID:\t%%assetid%%\n%%fimanaged%%Refreshed:\t%%refreshtime%%'
  }; // defaults
  use_storage.get(null, function(storage_items) {
    console.log('storage items: '+storage_items);
    Object.keys(storage_items).forEach(function(key) {
      settings[key] = storage_items[key];
    });
    if ( typeof chrome.enterprise !== "undefined" ) {
      if ( typeof chrome.enterprise.deviceAttributes !== "undefined" ) {
        if ( typeof chrome.enterprise.deviceAttributes.getDeviceSerialNumber !== "undefined" ) {
          settings.info_text = settings.info_text.replace(/%%ifmanaged%%/gi, '').replace(/%%fimanaged%%/gi, '');
        } else { settings.info_text = settings.info_text.replace(/%%ifmanaged%%[^]*?%%fimanaged%%/gi, ''); }
      } else { settings.info_text = settings.info_text.replace(/%%ifmanaged%%[^]*?%%fimanaged%%/gi, ''); }
    } else { settings.info_text = settings.info_text.replace(/%%ifmanaged%%[^]*?%%fimanaged%%/gi, ''); }
    getData(function() {
      chrome.system.display.getInfo(function (displays) {
        orientation = screen.orientation.type
        if ( orientation === 'landscape-primary' || orientation === 'landscape-secondary' ) {
          screen_width = displays[0].modes.slice(-1)[0].widthInNativePixels;
          screen_height = displays[0].modes.slice(-1)[0].heightInNativePixels;
        } else {
          screen_height = displays[0].modes.slice(-1)[0].widthInNativePixels;
          screen_width = displays[0].modes.slice(-1)[0].heightInNativePixels;
        }
        bounds = displays[0].bounds;
        workarea = displays[0].workArea;
        unusable_left_pixels = 5;
        unusable_right_pixels = 5;
        unusable_bottom_pixels = 5;
        unusable_top_pixels = 25;
        if (JSON.stringify(bounds) === JSON.stringify(workarea) ) { // hidden taskbar
        } else if (bounds.height != workarea.height) { // taskbar bottom
          mode_taskbar_height = bounds.height - workarea.height;
          mode_scale = bounds.height / screen_height;
          unusable_bottom_pixels += mode_taskbar_height / mode_scale;
        } else if (bounds.left != workarea.left) { // taskbar left
          mode_taskbar_width = workarea.left;
          mode_scale = bounds.width / screen_width;
          unusable_left_pixels += mode_taskbar_width / mode_scale;
        } else if (bounds.width != workarea.width) { // taskbar right
          mode_taskbar_width = bounds.width - workarea.width;
          mode_scale = bounds.width / screen_width;
          unusable_right_pixels += mode_taskbar_width / mode_scale;
        } else if (top != workarea.top) { // taskbar top
          mode_taskbar_height = bounds.height - workarea.height;
          mode_scale = bound.height / screen_height;
          unusable_top_pixels += mode_taskbar_height / mode_scale;
        }
        if ( settings.background_image ) {
          img = new Image;
          img.crossOrigin = "Anonymous";
          img.onload = draw_background;
          img.src = settings.background_image;
        } else {
          draw_background();
        }
      });
    });
  });
}

chrome.system.display.onDisplayChanged.addListener(function() {
  console.log('display change detected...');
  refresh_background('display-changed');
})

chrome.runtime.onStartup.addListener(function() {
  chrome.storage.local.set({start_time: Date.now()}, function() {
    console.log('profile started');
  })
})

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    refresh_background('user-requested');
    sendResponse('Background refreshed.');
});
