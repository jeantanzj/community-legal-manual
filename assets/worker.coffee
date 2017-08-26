---
# Jekyll front matter needed to trigger coffee compilation
---
# Web worker used to building the search index outside the main thread

importScripts "/assets/lunr.js"
console.log "Worker initialized"
@onmessage = (event) => 
  console.log "Starting to build index"
  siteSections = event.data
  index = lunr ->
    @ref 'url'
    @field 'title', boost: 10
    @field 'text'
    @metadataWhitelist = ['position']
    siteSections.forEach (section) =>
      @add
        'url': section.url
        'title': section.title
        'text': section.text
  console.log "Done building index"
  @postMessage index.toJSON()


