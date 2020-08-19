var schema = {};
var catalog = {};
var editor;
var config;

$.getJSON("editorConfig.json", function(data) {
  config = data;
  console.log(config.gitPath);
});

$(function() {
  var schemafile;

  $.getJSON('Catalog.json', afterSchemaLoad)
    .fail(function(jqxhr, status, error) {
      alert('Couldn\'t access schema file "catalog.json": \n' + error);
    });
  $('.row .btn').on('click', function(e) {
    e.preventDefault();
    var $this = $(this);
    var $collapse = $this.closest('.collapse-group').find('.collapse');
    $collapse.collapse('toggle');
  });
});

function afterSchemaLoad(json) {
  // Initialize the editor
  schema = json;

  JSONEditor.defaults.iconlibs.mybootstrap = JSONEditor.AbstractIconLib.extend({
    mapping: {
      collapse: 'resize-small',
      expand: 'resize-full',
      "delete": 'remove',
      edit: 'pencil',
      add: 'plus',
      cancel: 'floppy-remove',
      save: 'floppy-saved',
      moveup: 'arrow-up',
      movedown: 'arrow-down'
    },
    icon_prefix: 'glyphicon glyphicon-'
  });

  var alwaysname = {
    compile: function() {
      return function(vars) {
        return vars.self.name;
      }
    }
  };

  editor = new JSONEditor(document.getElementById('editor_holder'), {
    // Enable fetching schemas via ajax
    ajax: true,
    keep_oneof_values: false, // See https://github.com/jdorn/json-editor/issues/398

    // The schema for the editor
    schema: schema, //{ $ref: "schema2.json" },
    remove_empty_properties: true,
    //theme: "foundation5",
    theme: "bootstrap3",
    template: 'default', //alwaysname, // soooo much faster than the default template engine as long as we only use it for this.
    iconlib: "mybootstrap",
    disable_edit_json: true
  });
  editor.on('ready', function() {
    $("#nm-jsons").show();
  });

  $("#jsonoutput").change(function() {
    var t;
    try {
      t = JSON.parse($("#jsonoutput").val());
    } catch (e) {
      alert("There's a syntax problem with your JSON code. \n\n" + e.message);
      return;
    }

    var performance = window.performance;
    var t0 = performance.now();
    var errors = editor.validate(t);
    if (errors.length) {
      // errors is an array of objects, each with a `path`, `property`, and `message` parameter
      // `property` is the schema keyword that triggered the validation error (e.g. "minLength")
      // `path` is a dot separated path into the JSON object (e.g. "root.path.to.field")
      var msg = "There's a problem with your JSON code. \n\n";
      for (var i = 0; i < errors.length; i++) {
        msg += '[' + errors[i].path + '] ' + errors[i].message + '\n';
      }
      alert(msg);
      console.log(JSON.stringify(errors, null, 2));
    } else {
      console.log("Validation ok in " + ((performance.now() - t0) / 1000).toFixed(1) + " seconds.");
    }

    $("#loading h2").text("Parsing datasource file"); // Doesn't seem to display in time...

    var t0 = performance.now();
    editor.setValue(t);
    console.log("Loaded in " + ((performance.now() - t0) / 1000).toFixed(1) + " seconds.");
    $("#editor_holder").show();
    $("#loading").hide();
    $("#savejson").show();
    $("#editor_holder")[0].scrollIntoView();
  });

  // Hook up the validation indicator to update its
  // status whenever the editor changes
  editor.on('change', function() {
    // Get an array of errors from the validator
    var errors = editor.validate();

    // Not valid
    if (errors.length) {
      // probably not an issue, validation errors are shown already.
      // alert("Error in the schema file.")
      // console.log(JSON.stringify(errors,null,2));
    } else {
      //if (!$("#loading").is(":visible"))
      $("#jsonoutput").val(JSON.stringify(editor.getValue(), null, 2));
    }
  });

  populateSources();
}

function clickedExternalJson(e) {
  e.preventDefault();
  var url;
  targetname = e.target.textContent.trim();
  // Need to go through Github API or else CORS issues.
  if ($(e.target).data("url")) {
    url = $(e.target).data("url");
  } else if (targetname == '(blank)') {
    loadedFile({
      catalog: []
    });
    return;
  } else {
    url = config.otherCatalogsBaseUrl + targetname + '.json';
  }

  $("#sourceurl").val(url);
  return;
}

$("#nm-jsons li").click(clickedExternalJson);
$("#other-jsons li").click(clickedExternalJson);

$("#loadjson").click(clickLoadJSON);

// Possibly alter the current URL target, then load it.
function clickLoadJSON(e) {
  e.preventDefault();
  url = $("#sourceurl").val().trim()
  if (url.match('^https:\/\/gist.github.com')) {
    // handle loading user-friendly Gist URLs by looking up raw url first - we grab the first file.
    var newurl = url.replace(/^https:\/\/gist\.github\.com(\/[^\/]+(?=\/.))?/, 'https://api.github.com/gists');
    $.getJSON(newurl, null, function(j) {
      var f = j.files;
      var raw_url = j.files[Object.keys(j.files)[0]].raw_url;
      loadURL(raw_url);
    });
  } else {
    loadURL(url);
  }
}

// Retrieve the URL specified, then trigger loading.
function loadURL(url) {
  $.ajax({
    dataType: "json",
    url: url,
    accepts: {
      'json': 'application/vnd.github.v3.raw'
    },
    success: loadedFile,
    error: function(e) {
      alert("Error " + e.status + ": " + e.statusText);
    }
  });
  $("#editor_holder").hide();
  $("#loadingmsg").html("<h2>Loading datasource</h2>Large files may take a very long time. Really.");
  $("#loading").show();
}

// We have received file, put it in the JSON edit box, which will trigger parsing.
function loadedFile(t, status, request) {
  console.log(request);
  if (request !== undefined) {
    var remaining = request.getResponseHeader('X-RateLimit-Remaining');
    if (remaining !== null && Number(remaining) <= 5) {
      alert("GitHub limits file requests to 60 per hour. You only have " + remaining + " left. When they run out, you'll need to wait for a bit, " +
        "or manually copy/paste the source file in.");
    }
  }
  $("#jsonoutput").val(JSON.stringify(t, null, 2));
  $("#jsonoutput").trigger("change");
  return;
}

// Use the list of data sources in the list of clickable targets.
function populateSources() {
  var appendtarget = "#nm-jsons";

  function loadDataSourceList(url) {
    $.ajax({
      dataType: "json",
      url: url,
      accepts: {
        'json': 'application/vnd.github.v3.raw'
      },
      error: function(e) {
        alert("Error " + e.status + ": " + e.statusText);
      },
      success: loadedList
    });
  }

  function loadedList(j) {
    j.forEach(function(e) {
      if (e.url.match(/\.json/)) {
        //Use rawgit to save Github requests
        var url = 'https://raw.githubusercontent.com'+config.gitPath+'/master/' + e.path;
        $(appendtarget).append($(
          "<li><a href='#' data-url='" + url + "'" +
          ">" +
          e.name.replace('.json', '')
          .replace(/^\d\d_/, '')
          .replace(/^\d\d_/, '') // catch 00_01_names
          .replace(/_/g, ' ') +
          "</a>" +
          "</li>"
        ));
      }
    });
    $("#nm-jsons li").click(clickedExternalJson);
    console.log(j);
  };

  $("#nm-jsons").html("");

  var source = 'https://api.github.com/repos'+ config.gitPath+'/contents/';

  loadDataSourceList(source);
}

$("#savejson").click(function(e) {
  function savedGist(j) {
    var raw_url = j.files[Object.keys(j.files)[0]].raw_url;
    var cleanpreviewurl = config.mapPreviewUrl + encodeURIComponent(raw_url);
    $("#loadingmsg").html('<h2>Saved!</h2>' +
      '<p><a target="_blank" href="' + cleanpreviewurl + '">Preview your changes in TerriaMap</a></p>' +
      '<p> GIST with your changes: <a target="_blank" href="' + j.html_url + '">' + j.html_url + '</a></p>');
    $("#loading").show();
    $("#downloadfile").click(function(e) {
      saveTextAs($("#jsonoutput").val(), 'datasource.json');
    });
    console.log(j);
  }
  //e.preventDefault();
  var t = JSON.stringify(editor.getValue(), null, 2);
  var f = {
    description: 'Modified data source file',
    'public': false,
    files: {
      'datasource.json': { // extract actual filename
        'content': t
      }
    }
  };
  $("#loadingmsg").html("<h2>Saving datasource</h2>Saving a copy of your file...");
  $("#loading").show();

  $.ajax({
    url: 'https://api.github.com/gists',
    type: 'post',
    data: JSON.stringify(f),
    headers: {
      'Authorization': 'token '+ config.gistToken
    },
    dataType: 'json',
    success: savedGist
  });
});
