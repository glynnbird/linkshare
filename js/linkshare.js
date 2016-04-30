var db = null;
var configdoc = "_local/config";
var config = null;
var replication = null;

// get the currently seleted Chrome tab
var getCurrentTab = function(callback) {
  chrome.tabs.getSelected(null,function(tab) {
    console.log(tab);
    callback(null, tab);
  });
};

var loadConfig = function(callback) {
  db.get(configdoc, function(err, data) {
    if (err) {
      data = { _id: configdoc, url: null};
    }
    config = data;
    callback(null, data);
  });
};

var saveConfig = function(callback) {
  db.put(config,callback);
};

// MapReduce function that orders by date
var map = function(doc) {
  if (doc.date) {
    emit(doc.date,null);
  }
};

var extractDomain = function (url) {
    var domain;
    //find & remove protocol (http, ftp, etc.) and get domain
    if (url.indexOf("://") > -1) {
        domain = url.split('/')[2];
    }
    else {
        domain = url.split('/')[0];
    }

    //find & remove port number
    domain = domain.split(':')[0];

    return domain;
}

var loadLinks = function() {
  console.log("loadlinks");
  db.query(map, {include_docs:true, descending:true}).then(function(result) {
    console.log("loadlinks", result);
    var html = '<tbody>';
   
    for(var i in result.rows) {
      var doc = result.rows[i].doc;
      html += '<tr>';
      html += '<td><a class="truncate" href="' + doc.url + '" title="' + doc.url + '" target="_new">' + doc.title + '</a><br />'
      html += '<span class="domain">' + extractDomain(doc.url) + '</span>';
      html += '</td>';
      html += '<td><button class="pseudo" data-id="' + doc._id +'" data-rev="' + doc._rev + '"><img src="remove.png" class="removeicon"/></button></td>'
      html += '</tr>';
    }
    html += '</tbody>';
    $('#thetable').html(html);
    
    // when the delete button is pressed
    $(".delete").bind("click", function(event) {
      var b = $( this );
      var id = b.attr("data-id");
      var rev = b.attr("data-rev");
      db.remove(id,rev, function() {
        loadLinks();
      })
    });
  });
};

var saveLink = function(callback) {
  getCurrentTab(function(err, tab) {
    var doc = {
      url: tab.url,
      date: (new Date()).toISOString(),
      title: tab.title
    }
    db.post(doc, callback);
  });
};

var kickOffReplication = function() {
  if (replication != null) {
    replication.cancel();
  }
  if (config.url) {
    replication = db.sync(config.url, {
      live:true, 
      retry:true
    }).on('change', function(change){ 
      console.log("change", change);
      loadLinks();
    });
  }
}

// when the page has loaded
$( document ).ready(function() {
  console.log("document is ready!");
  
  // start up PouchDB
  db = new PouchDB("linkshare");
  
  loadLinks();
  
  // when the save button is pressed
  $("#save").bind("click", function() {
    saveLink(function() {
      loadLinks();
    })
  });
  
  
  // when the settings/save button is pressed
  $("#settingssave").bind("click", function() {
    config.url = $('#replicationurl').val();
    saveConfig(function(err, data) {
      kickOffReplication();
      console.log("save",err, data);
    })
  });
  
  // load the config
  loadConfig(function(err, data) {
    console.log("!", err, data);
    if (!err && data.url) {
      $('#replicationurl').val(data.url);
      kickOffReplication();
    } 
  })


});