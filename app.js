var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var request = require('request');

var HTTP_PORT = process.env.PORT || 3000;
var ENV = {'BONSAI_URL': process.env.BONSAI_URL || '' , 
	'BONSAI_USERNAME': process.env.BONSAI_USERNAME || '', 
	'BONSAI_PASSWORD': process.env.BONSAI_PASSWORD || '',
	'BONSAI_SEARCH_ENDPOINT' : process.env.BONSAI_SEARCH_ENDPOINT || ''};

Object.values(ENV).forEach(function(val) { 
	if(val === ''){
		console.log('One or more environment variables for connecting to the elastic search database is missing: '+ JSON.stringify(ENV));
		process.exit(1);
	}
});

var allowCrossDomain = function(request, response, next) {
    response.header('Access-Control-Allow-Origin', "*");
    response.header('Access-Control-Allow-Methods', 'GET,POST');
    response.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
} 

var app = express();
app.use(allowCrossDomain);
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies


http.createServer(app)
	.listen(HTTP_PORT, function() { console.log("Listening on port " + HTTP_PORT); });

app.get('/', function(req,res){
	res.send('Endpoint: POST /search');
})
app.post('/search', function(req, res){
	var query = req.body.query;
	esSearch(query, res);
});
app.get('/search', function(req, res){
	res.send('Endpoint: POST /search');
});
btoa = function(str) { return Buffer.from(str).toString('base64'); };

createEsQuery = function(queryStr) {
    var highlight, query;
    highlight = {};
    highlight.require_field_match = false;
    highlight.fields = {};
    highlight.fields.content = {
      "fragment_size": 120,
      "number_of_fragments": 1,
      "pre_tags": ["<strong>"],
      "post_tags": ["</strong>"]
    };
    query = {};
    query.match_phrase_prefix = {};
    query.match_phrase_prefix.content = {};
    query.match_phrase_prefix.content.query = queryStr;
    query.match_phrase_prefix.content.slop = 3;
    query.match_phrase_prefix.content.max_expansions = 10;
    return {
      "query": query,
      "highlight": highlight
    };
  };

esSearch = function(query, res) {
    var auth, esQuery, esQueryJson, options;
   	auth = btoa(ENV.BONSAI_USERNAME+':'+ENV.BONSAI_PASSWORD);
    esQuery = createEsQuery(query);
    esQueryJson = JSON.stringify(esQuery);
    options = {
		  url: ENV.BONSAI_URL+ENV.BONSAI_SEARCH_ENDPOINT,
		  headers: {
		    'Content-Type': 'application/json',
		    'Authorization': 'Basic ' + auth
		  },
		  body: esQueryJson
	};
    return request.post(
	    options,
	    function (error, response, body) {
	    	retVal = {"server" : options.url};
	        if (!error && response.statusCode == 200) {
	        	retVal.body = JSON.parse(body);
	        }
	        else{
	        	retVal.error = error === null || Object.keys(error).length === 0 ? 'Error retrieving search results' : error;
	        	retVal.query = esQuery;
	        }
	        res.send(retVal);
	    }
	);

  };