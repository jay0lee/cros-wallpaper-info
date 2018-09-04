default_settings = {
  refresh_time: 15,
  text_color: 'White',
  text_font: 'Monospace',
  text_size: 20,
  background_gradient_color1: 'DarkBlue',
  background_gradient_color2: 'LightBlue',
  info_text_location: 'top right',
  info_text: 'OS:\tChrome %%browserversion%% Platform %%osversion%%\nCPU:\t%%cpumodel%% - %%cpucores%% cores - %%cputempf%% °F\nMemory:\t%%memunused%% unused of %%memtotal%% total\nStorage:\t%%diskfree%% free of %%disktotal%% total\nUser:\t%%useremail%%\nIP Addresses:\t%%ipaddresses%%\nUser Logged In:\t%%userlogintime%%\n%%ifmanaged%%Serial Number:\t%%serialnumber%%\nLocation:\t%%location%%\nAsset ID:\t%%assetid%%\n%%fimanaged%%Refreshed:\t%%refreshtime%%'
};

function init_page() {
  colors = ["Pink", "LightPink", "HotPink", "DeepPink", "PaleVioletRed", "MediumVioletRed",
"Lavender", "Thistle", "Plum", "Orchid", "Violet", "Fuchsia", "Magenta",
"MediumOrchid", "DarkOrchid", "DarkViolet", "BlueViolet", "DarkMagenta",
"Purple", "MediumPurple", "MediumSlateBlue", "SlateBlue", "DarkSlateBlue",
"RebeccaPurple", "Indigo", "LightSalmon", "Salmon", "DarkSalmon", "LightCoral",
"IndianRed", "Crimson", "Red", "FireBrick", "DarkRed", "Orange", "DarkOrange",
"Coral", "Tomato", "OrangeRed", "Gold", "Yellow", "LightYellow",
"LemonChiffon", "LightGoldenRodYellow", "PapayaWhip", "Moccasin", "PeachPuff",
"PaleGoldenRod", "Khaki", "DarkKhaki", "GreenYellow", "Chartreuse",
"LawnGreen", "Lime", "LimeGreen", "PaleGreen", "LightGreen",
"MediumSpringGreen", "SpringGreen", "MediumSeaGreen", "SeaGreen",
"ForestGreen", "Green", "DarkGreen", "YellowGreen", "OliveDrab",
"DarkOliveGreen", "MediumAquaMarine", "DarkSeaGreen", "LightSeaGreen",
"DarkCyan", "Teal", "Aqua", "Cyan", "LightCyan", "PaleTurquoise",
"Aquamarine", "Turquoise", "MediumTurquoise", "DarkTurquoise", "CadetBlue",
"SteelBlue", "LightSteelBlue", "LightBlue", "PowderBlue", "LightSkyBlue",
"SkyBlue", "CornflowerBlue", "DeepSkyBlue", "DodgerBlue", "RoyalBlue", "Blue",
"MediumBlue", "DarkBlue", "Navy", "MidnightBlue", "Cornsilk", "BlanchedAlmond",
"Bisque", "NavajoWhite", "Wheat", "BurlyWood", "Tan", "RosyBrown",
"SandyBrown", "GoldenRod", "DarkGoldenRod", "Peru", "Chocolate", "Olive",
"SaddleBrown", "Sienna", "Brown", "Maroon", "White", "Snow", "HoneyDew",
"MintCream", "Azure", "AliceBlue", "GhostWhite", "WhiteSmoke", "SeaShell",
"Beige", "OldLace", "FloralWhite", "Ivory", "AntiqueWhite", "Linen",
"LavenderBlush", "MistyRose", "Gainsboro", "LightGray", "Silver", "DarkGray",
"DimGray", "Gray", "LightSlateGray", "SlateGray", "DarkSlateGray", "Black"];

  a = document.getElementById("background_gradient_color1");
  b = document.getElementById("background_gradient_color2");
  c = document.getElementById("text_color");
  [a, b, c].forEach(function(element) {
    colors.forEach(function(color) {
      var option = document.createElement("option");
      option.text = color;
      option.value = color;
      option.style = "background-color: "+color+";"
      element.add(option);
      });
  });
}

document.addEventListener('DOMContentLoaded', init_page);
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click',
    save_options);
document.getElementById('defaults').addEventListener('click',
    restore_defaults);
document.getElementById('drawnow').addEventListener('click',
    draw_now);
document.getElementById('dlpolicy').addEventListener('click',
    gen_policy);

function save_options() {
  var settings = {
    refresh_time: document.getElementById('refresh_time').value,
    background_gradient_color1: document.getElementById('background_gradient_color1').value,
    background_gradient_color2: document.getElementById('background_gradient_color2').value,
    text_color: document.getElementById('text_color').value,
    text_font: document.getElementById('text_font').value,
    info_text_location: document.getElementById('info_text_location').value,
    text_size: parseInt(document.getElementById('text_size').value, 10),
    info_text: document.getElementById('info_text').value
  };
  background_image = document.getElementById('background_image').value;
  if (background_image) {
    settings.background_image = background_image;
  } else {
    use_storage.remove('background_image', function() {
      console.log('removed image setting.');
    });
  }
  use_storage.set(settings, function() {
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

function restore_defaults() {
  use_storage.set(default_settings, function() {
    restore_options();
    var status = document.getElementById('status');
    status.textContent = "Defaults restored.";
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

function draw_now() {
  chrome.extension.sendMessage({}, function(data) {
    var status = document.getElementById('status');
    status.textContent = data;
    setTimeout(function() {
      status.textContent = '';
    }, 1500);
  });
}

function restore_options() {
  chrome.management.getSelf(function (exinfo) {
    if ( exinfo.installType == 'admin' ) {
      use_storage = chrome.storage.managed;
      document.getElementById("save").disabled = true;
      document.getElementById("defaults").disabled = true;
    } else {
      use_storage = chrome.storage.sync;
    }
    use_storage.get(default_settings, function(items) {
      document.getElementById('refresh_time').value = items.refresh_time;
      document.getElementById('text_color').value = items.text_color;
      document.getElementById('text_font').value = items.text_font;
      document.getElementById('text_size').value = items.text_size;
      document.getElementById('background_image').value = "";
      document.getElementById('background_gradient_color1').value = items.background_gradient_color1;
      document.getElementById('background_gradient_color2').value = items.background_gradient_color2;
      document.getElementById('info_text_location').value = items.info_text_location;
      document.getElementById('info_text').value = items.info_text;
    });
  });
}

function gen_policy() {
  use_storage.get(default_settings, function(settings) {
    policy = {}
    Object.keys(settings).forEach(function(key) {
      value = settings[key];
      policy[key] = {Value: value};
    });
    policy_str = JSON.stringify(policy, null, 2);
    download(policy_str, 'admin-console-wallpaper-policy.json', 'application/json');
  });
}

function download(data, filename, type) { // thanks to https://stackoverflow.com/a/30832210
  var file = new Blob([data], {type: type});
  var a = document.createElement("a"),
  url = URL.createObjectURL(file);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
}