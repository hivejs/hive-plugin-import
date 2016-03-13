var vdom = require('virtual-dom')
  , h = vdom.h
  , match = require('mime-match')

module.exports = setup
module.exports.consumes = ['ui', 'api']
module.exports.provides = ['import']

const IMPORTED = 'IMPORT_IMPORTED'
const IMPORTING = 'IMPORT_IMPORTING'
const TOGGLE_IMPORT_DROPDOWN = 'IMPORT_TOGGLE_DROPDOWN'

function setup(plugin, imports, register) {
  var ui = imports.ui
    , api = imports.api

  ui.reduxReducerMap['import'] = reducer

  function reducer(state, action) {
    if(!state) {
      return {
        importTypes: ui.config['importexport:importTypes']
      , showImportDropdown: false
      , importing: false
      , importError: false
      }
    }
    if(TOGGLE_IMPORT_DROPDOWN === action.type) {
      return {...state
      , showImportDropdown: !state.showImportDropdown
      , importError: false
      }
    }
    if(IMPORTING == action.type) {
      return {...state, importing: action.payload, importError: false}
    }
    if(IMPORTED === action.type && action.error) {
      return {...state, importing: false, importError: action.error}
    }
    if(IMPORTED == action.type) {
      return {...state
        , importing: false
        , importError: false
        , showImportDropdown: false
      }
    }
    return state
  }

  var importProvider = {
    action_import: function*(files) {
      var file = files[0]
        , state = ui.store.getState()
        , importTypes = state['import'].importTypes[state.editor.document.attributes.type]
        , documentId = ui.store.getState().editor.document.id
      try {
        if(file.type && !importTypes.filter(match(file.type)).length) {
          throw new Error('File type not supported')
        }
        yield importProvider.action_importing(file.name)
        yield api.action_document_import(documentId, file)
        yield {type: IMPORTED}
      }catch(e) {
        console.error(e)
        yield {type: IMPORTED, error: e.message}
      }
    }
  , action_toggleImportDropdown: function() {
      return {type: TOGGLE_IMPORT_DROPDOWN}
    }
  , action_importing: function(filename) {
      return {type: IMPORTING, payload:filename}
    }
  , renderImport
  , renderImportDropdown
  }

  ui.onRenderNavbarRight((store, children) => {
    var state = store.getState()
    if(!state.editor.editor) return
    if(state.editor.document && state['import'].importTypes[state.editor.document.attributes.type]) {
      children.unshift(renderImport(store))
    }
  })

  function renderImport(store) {
    var document = store.getState().editor.document
    var state = store.getState()['import']

    return h('li.dropdown'+(state.showImportDropdown? '.open' : ''), [
      h('a.dropdown-toggle', {
          href: 'javascript:void(0)'
        , 'ev-click': evt => store.dispatch(importProvider.action_toggleImportDropdown())
        , id: 'importMenu'
        , attributes: {
            'data-toggle': 'dropdown'
          , 'aria-haspopup': 'true'
          , 'aria-expanded': state.showImportDropdown? 'true' : 'false'
          }
        , title: ui._('plugin-import/import')()
        }
      , [
          h('i.glyphicon.glyphicon-import')
        , h('span.sr-only', ui._('plugin-import/import')())
        , h('span.caret')
        ]
      )
    , h('ul.dropdown-menu'
      , { attributes: {'aria-labelledby':'importMenu'}
        }
      , renderImportDropdown(store)
      )
    ])
  }

  function renderImportDropdown(store) {
    var state = store.getState()['import']

    var children = [h('li.dropdown-header', ui._('plugin-import/import')())]

    if(!window.File || !window.FileReader || !window.FileList || !window.Blob) {
      children.push(h('li'
      , h('a', ui._('plugin-import/import-browser-not-supported')())
      ))
      return children
    }

    if(state.importing) {
      children.push(h('li'
      , h('a', ui._('plugin-import/importing')({file:state.importing}))
      ))
      return children
    }


    children.push(
      h('li', h('a', [
        h('input', {
          type: 'file'
        , 'ev-change': evt => {
            store.dispatch(importProvider.action_import(evt.currentTarget.files))
          }
        })
      ]))
    )

    if(state.importError) {
      children.push(
        h('li', h('div.alert.alert-danger', [
          h('strong', 'Error!')
        , ' '+state.importError
        ]))
      )
    }

    return children
  }

  register(null, {'import': importProvider})
}
