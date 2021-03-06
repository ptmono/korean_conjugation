var express = require('express')
  , conjugator = require('./html/korean/conjugator')
  , hangeul = require('./html/korean/hangeul')
  , pronunciation = require('./html/korean/pronunciation.js')
  , romanization = require('./html/korean/romanization')
  , sqlite3 = require('sqlite3');

var app = express.createServer();

app.configure(function(){
  app.use(express.methodOverride());
  app.use(express.bodyParser());
  app.use(app.router);
  app.set('view engine', 'jade');
});

app.configure('development', function(){
  app.use(express.static(__dirname + '/html'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.static(__dirname + '/html'));
  app.use(express.errorHandler());
});

// For Joseph Speigle - may he rest in peace

app.post('/api/v1/pronunciation', function (req, res) {
  var word = req.param('word', '');
  var korean_pronunciation = pronunciation.get_pronunciation(word);
  res.json({
    'version': pronunciation.version + '.' + romanization.version,
    'word': word,
    'korean_pronunciation': korean_pronunciation,
    'romanization': romanization.romanize(korean_pronunciation)
  });
});

// For Joseph Speigle - may he rest in peace

app.post('/api/v1/conjugation', function (req, res) {
  var verb = req.param('verb', '');
  conjugator.conjugate_json(verb, req.param('regular', false), function(json) {
    res.json({
      'version': conjugator.version,
      'verb': verb,
      'conjugation': json
    });
  });
});

app.get('/', function (req, res) {
  var search = req.query.search;
  // redirect old requests from when the site only handled infinitive lookups
  if (req.query.infinitive) {
    return res.redirect('/?search=' + req.query.infinitive);
  }
  if (!search) {
    return res.redirect('/?search=하다');
  }
  // if non-hangeul characters appear in the input search the definitions
  if (!hangeul.is_hangeul_string(search)) {
    select_by_definition.all(
      search + '*',
      function(err, results) {
        // redirect to the conjugation if there is only one result
        if (results.length == 1) {
          return res.redirect('/?search=' + results[0].infinitive);
        }
        res.render('definition-search.jade', {
          search: search,
          results: results
        });
      }
    );
  } else {
    var infinitive = conjugator.base(search || '하') + '다';
    var verbs = [];
    var definitions = [];
    var valid_verbs = [];
    select_definition.all(infinitive.replace(/ /g, ''), function(err, results) {
      definitions = results.map(function(x) { return x.definition });
      select_verb_type.all(infinitive.replace(/ /g, ''), function(err, results) {
        valid_verbs = results;
        conjugator.conjugate(
          infinitive,
          req.query.regular,
          function(conjugations) {
            res.render('index.jade', {
              search: infinitive,
              conjugations: conjugations,
              definitions: definitions,
              valid_verbs: valid_verbs
            });
          }
        );
      });
    });
  }
});

var select_definition;

var db = new sqlite3.Database('korean-verb-database/korean-verbs.sqlite', sqlite3.OPEN_READONLY, function() {
  select_definition = db.prepare("SELECT definition FROM verbs WHERE infinitive = ?");
  select_verb_type = db.prepare("SELECT infinitive, verb_type FROM valid_verbs WHERE infinitive = ?");
  select_by_definition = db.prepare("SELECT infinitive, definition FROM verbs WHERE definition MATCH ?");
  app.listen(3000);
  console.log('Server running at http://127.0.0.1:3000/');
});
