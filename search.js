//Search methods
module.exports = function(app_params) {
  const logger = app_params.logger;
  const request = app_params.request;

  esSearch = function(params) {
      var esQuery, esQueryJson, options;
      esQuery = createEsQuery(params.query);
      esQueryJson = JSON.stringify(esQuery);
      options = {
        url: params.url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + params.auth
        },
        body: esQueryJson
      };
      return new Promise( (resolve, reject) => {
        request.post(
        options,
        function (error, response, body) {
          retVal = {"server" : options.url};
            if (!error && response.statusCode == 200) {
              retVal.body = JSON.parse(body);
              resolve(retVal);
            }
            else{
              retVal.body = body;
              retVal.query = esQuery;
              reject(retVal);
            }
        }
      ); 
    });
  };
  return {esSearch : esSearch};
};
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

