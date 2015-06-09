var request = new XMLHttpRequest();
var schema={};
var catalog={};
var editor;


request.onload = function() {
  if (request.status >= 200 && request.status < 400) {
    // Success!
    try {
      schema =  JSON.parse(request.responseText);
      afterSchemaLoad();
    } catch (e) {
      alert ("Problem loading schema: " + e.message);
    }

} else {
    alert ("Couldn't access schema.");
  }
};

request.onerror = function() {
    alert ("Couldn't access schema.");
};


$(function() {
  setTimeout(function() {
    request.open('GET', 'catalog.json', true);
    request.send();
  }, 100);
});



      
function afterSchemaLoad() { 
    // Initialize the editor

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
        return function (vars) {
          return vars.self.name;
        }
      }
    };


    editor = new JSONEditor(document.getElementById('editor_holder'),{
      // Enable fetching schemas via ajax
      ajax: true,
      keep_oneof_values: false, // See https://github.com/jdorn/json-editor/issues/398
      
      // The schema for the editor
      schema: schema,//{ $ref: "schema2.json" },
      remove_empty_properties: true,
      //theme: "foundation5",
      theme: "bootstrap3",
      template: 'default',//alwaysname, // soooo much faster than the default template engine as long as we only use it for this.
      iconlib: "mybootstrap", 
      disable_edit_json: true
    });
    editor.on('ready', function() {
      $("#external-jsons").show();
    });


  $("#jsonoutput").change(function() {
    var t = JSON.parse($("#jsonoutput").val());

    var performance = window.performance;
    var t0 = performance.now();
    var errors = editor.validate(t);
    if(errors.length) {
      // errors is an array of objects, each with a `path`, `property`, and `message` parameter
      // `property` is the schema keyword that triggered the validation error (e.g. "minLength")
      // `path` is a dot separated path into the JSON object (e.g. "root.path.to.field")
      console.log(JSON.stringify(errors,null,2));
    }
    else {
      console.log("Validation ok in " + ((performance.now() - t0)/1000).toFixed(1) + " seconds.");
    }


    $("#loading h2").text("Parsing datasource file"); // Doesn't seem to display in time...

    var t0 = performance.now();
    editor.setValue(t);
    console.log("Loaded in " + ((performance.now() - t0)/1000).toFixed(1) + " seconds.");
    $("#editor_holder").show();
    $("#loading").hide();


  });
  
  // Hook up the validation indicator to update its 
  // status whenever the editor changes
  editor.on('change',function() {
    // Get an array of errors from the validator
    var errors = editor.validate();
    
    // Not valid
    if(errors.length) {
      // probably not an issue, validation errors are shown already.
      // alert("Error in the schema file.")
      // console.log(JSON.stringify(errors,null,2));
    } else {
      if (!$("#loading").is(":visible"))
        $("#jsonoutput").val(JSON.stringify(editor.getValue(), null, 2));
    }
  });
}
$("#external-jsons li").click(function(e) {
  e.preventDefault();
  var url;
  targetname = e.target.textContent.trim();
  // Need to go through Github API or else CORS issues. 

  if  (targetname=='test-special') {
    url = 'https://gist.githubusercontent.com/stevage/08f89468f51822ade8d7/raw/ced603a2dd6c4dd8664751bc45915a45f493dcbf/gistfile1.json';
  } else if (targetname == 'ganew') {
    url ='https://api.github.com/repos/NICTA/nationalmap/contents/wwwroot/init/ganew.json?ref=ga-datasource';
  } else if (targetname == 'aremi') {
    url = 'https://api.github.com/repos/NICTA/aremi-natmap/contents/wwwroot/init/aremi.json';
  } else {
    url = 'https://api.github.com/repos/NICTA/nationalmap/contents/wwwroot/init/' + targetname + '.json';
  }

  $("#sourceurl").val(url);
  return;
 });

//https://api.github.com/gists/08f89468f51822ade8d7

$("#loadjson").click(function(e) {
  e.preventDefault();
  url = $("#sourceurl").val().trim()
  if (url.match('^https:\/\/gist.github.com')) {
    // handle loading user-friendly Gist URLs by looking up raw url first
    var newurl = url.replace(/^https:\/\/gist\.github\.com(\/[^\/]+(?=\/.))?/, 'https://api.github.com/gists');
    $.getJSON(newurl, null, function(j) {
      var f = j.files;
      var raw_url = j.files[Object.keys(j.files)[0]].raw_url;
      loadURL(raw_url);

    });
  }
 
});

function loadURL(url) {
   $.ajax({
      dataType: "json",
      url: url,
      accepts: { 'json': 'application/vnd.github.v3.raw'},
      success: loadedFile,
      error: function(e) { alert("Error " + e.status + ": " + e.statusText); }
  });
  $("#editor_holder").hide();
  $("#loadingmsg").html("<h2>Loading datasource</h2>Large files may take a very long time. Really.");
  $("#loading").show();

}

function loadedFile(t) {
    $("#jsonoutput").val(JSON.stringify(t,null,2));
    $("#jsonoutput").trigger("change");
    $("#savejson").show();
    return;
    
}

$("#savejson").click(function(e) {
  function savedGist(e) {
    $("#loadingmsg").html('<h2>Saved!</h2>Your new datasource file has been saved to: <a href="' + e.html_url + '">' + e.html_url + '</a>' +
      '<p>Send this URL to the person who manages your TerriaJS server.</p>');
    $("#loading").show();
    console.log(e);
    //$("#sourceurl").val(
  }
  //e.preventDefault();
  var t = JSON.stringify(editor.getValue(),null,2);
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
  $.post('https://api.github.com/gists', JSON.stringify(f), savedGist, 'json');
});
