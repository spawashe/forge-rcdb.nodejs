/////////////////////////////////////////////////////////////////
// Configurator Extension
// By Philippe Leefsma, February 2016
//
/////////////////////////////////////////////////////////////////
import {ReflexContainer, ReflexElement, ReflexSplitter} from 'react-reflex'
import HotSpotPropertyPanel from './Predix.HotSpot.PropertyPanel'
import ExtensionBase from 'Viewer.ExtensionBase'
import PredixPopover from './Predix.Popover'
import EventTool from 'Viewer.EventTool'
import ServiceManager from 'SvcManager'
import Toolkit from 'Viewer.Toolkit'

// React Stuff
import WidgetContainer from 'WidgetContainer'
import IoTGraph from './IoTGraph'
import React from 'react'
import './Data.scss'

// Commands
import HotSpotCommand from 'HotSpot.Command'

import hotspots from './hotspots'


class PredixConfiguratorExtension extends ExtensionBase {

  /////////////////////////////////////////////////////////////////
  // Class constructor
  //
  /////////////////////////////////////////////////////////////////
  constructor (viewer, options) {

    super (viewer, options)

    this.onGeometryLoaded = this.onGeometryLoaded.bind(this)

    this.onSelection = this.onSelection.bind(this)

    this.react = this._options.react

    this.hotSpotCommand = new HotSpotCommand (viewer, {
      parentControl: options.parentControl,
      hotspots
    })

    this.panel = new HotSpotPropertyPanel(
      this.viewer.container,
      this.guid(),
      'Hotspot Data')

    var controlledHotspot = null

    this.hotSpotCommand.on('hotspot.created', (hotspot) => {

      if (hotspot.data.controlled) {

        controlledHotspot = hotspot

        hotspot.hide()
      }
    })

    this.hotSpotCommand.on('hotspot.clicked', (hotspot) => {

      const state =  this.react.getState()

      //console.log(JSON.stringify(this.viewer.getState({viewport:true})))

      this.panel.setProperties(hotspot.data.properties)

      this.hotSpotCommand.isolate(hotspot.id)

      this.panel.setVisible(true)

      this.viewer.restoreState(
        hotspot.data.viewerState)

      Toolkit.isolateFull(
        this.viewer,
        hotspot.data.isolateIds)

      const id = hotspot.data.id

      const stateHotSpots = state.hotspots.map((hotspot) => {

        return Object.assign({}, hotspot, {
          active: hotspot.id === id
        })
      })

      this.react.setState({
        activeItem: hotspot.data,
        hotspots: stateHotSpots
      })
    })

    this.socketSvc = ServiceManager.getService('SocketSvc')

    this.socketSvc.on('sensor.temperature', (data) => {

      if (!controlledHotspot) {

        return
      }

      const state = this.react.getState()

      const activeItem = state.activeItem

      if (activeItem && (activeItem.id === controlledHotspot.id)) {

        this.react.setState({
          graphData: data
        })
      }

      if (data.objectTemperature > data.threshold) {

        clearTimeout(this.timeout)

        this.timeout = null

        controlledHotspot.data.strokeColor = '#FF0000'
        controlledHotspot.data.fillColor = '#FF8888'

        if (controlledHotspot)
        controlledHotspot.show()

        const stateHostSpots = state.hotspots.filter((hotspot) => {
          return !hotspot.controlled
        })

        this.react.setState({
          hotspots: [
            ...stateHostSpots,
            controlledHotspot.data
          ]
        })

      } else {

        this.react.setState({
          hotspots: state.hotspots.map((hotspot) => {

            if (hotspot.id === controlledHotspot.id) {

              hotspot.strokeColor = '#4CAF50'
              hotspot.fillColor = '#4CAF50'
            }

            return hotspot
          })
        })

        if (!this.timeout) {

          this.timeout = setTimeout(() => {

            this.timeout = null

            controlledHotspot.hide()

            this.react.setState({
              hotspots: state.hotspots.filter((hotspot) => {
                return !hotspot.controlled
              })
            })

            if (activeItem && (activeItem.id === controlledHotspot.id)) {

              this.react.setState({
                activeItem: null,
                graphData: null
              })
            }
          }, 20 * 1000)
        }
      }
    })

    this.timeout = null
  }

  /////////////////////////////////////////////////////////////////
  // Load callback
  //
  /////////////////////////////////////////////////////////////////
  load() {

    this.viewer.loadDynamicExtension(
      'Viewing.Extension.UISettings', {
        toolbar:{
          removedControls: [
            '#navTools'
          ],
          retargetedControls: [

          ]
        }
    })

    this.viewer.loadDynamicExtension(
      'Viewing.Extension.ContextMenu', {
        buildMenu: (menu, selectedDbId) => {
          return !selectedDbId
            ? [{
                title: 'Show all objects',
                target: () => {
                  Toolkit.isolateFull(this.viewer)
                  this.hotSpotCommand.isolate()
                  this.viewer.fitToView()
              }}]
            : menu
        }
    })

    this.eventTool = new EventTool(this.viewer)

    this.eventTool.activate()

    this.eventTool.on('singleclick', (event) => {

      this.pointer = event
    })

    this.viewer.addEventListener(
      Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT,
      this.onSelection)

    this.viewer.addEventListener(
      Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT, (e) => {

        this._options.loader.hide()
        this.hotSpotCommand.activate()
      })

    this.viewer.addEventListener(
      Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
      this.onGeometryLoaded)

    this.viewer.setProgressiveRendering(true)
    this.viewer.setQualityLevel(false, true)
    this.viewer.setGroundReflection(false)
    this.viewer.setGroundShadow(false)
    this.viewer.setLightPreset(1)

    this.react.pushRenderExtension(this)

    this.react.setState({
      hotspots: hotspots.filter((hotspot) => {
        return !hotspot.controlled
      })
    })

    return true
  }

  /////////////////////////////////////////////////////////////////
  // Extension Id
  //
  /////////////////////////////////////////////////////////////////
  static get ExtensionId () {

    return 'Viewing.Extension.Configurator.Predix'
  }

  /////////////////////////////////////////////////////////////////
  // Unload callback
  //
  /////////////////////////////////////////////////////////////////
  unload () {

    this.viewer.removeEventListener(
      Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
      this.onGeometryLoaded)

    this.hotSpotCommand.deactivate()

    return true
  }

  /////////////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////////////
  onGeometryLoaded (event) {

  }

  /////////////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////////////
  onSelection (event) {

    if (event.selections && event.selections.length) {

      const selection = event.selections[0]

      const dbIds = selection.dbIdArray

      const data = this.viewer.clientToWorld(
        this.pointer.canvasX,
        this.pointer.canvasY,
        true)

      console.log(data)
    }
  }

  /////////////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////////////
  onItemClicked (item) {

    const state = this.react.getState()

    const activeItem = state.activeItem

    if (activeItem && (activeItem.id === item.id)) {

      const stateHotSpots = state.hotspots.map((hotspot) => {

        return Object.assign({}, hotspot, {
          active: false
        })
      })

      this.react.setState({
        hotspots: stateHotSpots,
        activeItem: null,
        graphData: null
      })

      Toolkit.isolateFull(this.viewer)

      this.hotSpotCommand.isolate()

      this.panel.setVisible(false)

      this.viewer.fitToView()

    } else {

      this.panel.setProperties(item.properties)

      this.hotSpotCommand.isolate(item.id)

      this.panel.setVisible(true)

      this.viewer.restoreState(
        item.viewerState)

      Toolkit.isolateFull(
        this.viewer,
        item.isolateIds)

      const stateHotSpots = state.hotspots.map((hotspot) => {

        return Object.assign({}, hotspot, {
          active: hotspot.id === item.id
        })
      })

      this.react.setState({
        hotspots: stateHotSpots,
        activeItem: item,
        graphData: null
      })
    }
  }

  /////////////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////////////
  hexToRgbA (hex, alpha) {

    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {

      var c = hex.substring(1).split('')

      if (c.length == 3) {

        c = [c[0], c[0], c[1], c[1], c[2], c[2]]
      }

      c = '0x' + c.join('')

      return `rgba(${(c>>16)&255},${(c>>8)&255},${c&255},${alpha})`
    }

    throw new Error('Bad Hex Number: ' + hex)
  }

  /////////////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////////////
  render () {

    const state = this.react.getState()

    var renderGraph = false

    const items = state.hotspots.map((hotspot) => {

      const active = hotspot.active ? ' active' : ''

      if (active.length) {

        renderGraph = true
      }

      const style = {
        backgroundColor: this.hexToRgbA(hotspot.fillColor, 0.3),
        border: `2px solid ${hotspot.strokeColor}`
      }

      return (
        <div key={`item-${hotspot.id}`}
          className={'list-item ' + active}
          onClick={() => {
            this.onItemClicked(hotspot)
          }}>
          <div className="item-priority" style={style}>
          </div>
          <label>
            {hotspot.name || hotspot.id}
          </label>
        </div>
      )
    })

    const threshold = state.graphData
      ? state.graphData.threshold
      : 20 + (0.5 - Math.random()) * 10

    const value = state.graphData
      ? state.graphData.objectTemperature
      : null

    return (
      <WidgetContainer title="Incidents">
        <ReflexContainer key="incidents" orientation='horizontal'>
          <ReflexElement flex={0.35}>
            <div className="item-list-container">
              {items}
            </div>
          </ReflexElement>
          <ReflexSplitter/>
          <ReflexElement className="graph-list-container"
            renderOnResize={true}
            propagateDimensions={true}>

              <IoTGraph
                activeItem={state.activeItem}
                threshold={threshold}
                value={value}
                tagIdx={0} />

              <IoTGraph activeItem={state.activeItem} tagIdx={1}/>
              <IoTGraph activeItem={state.activeItem} tagIdx={2}/>

          </ReflexElement>
        </ReflexContainer>
      </WidgetContainer>
    )
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
  PredixConfiguratorExtension.ExtensionId,
  PredixConfiguratorExtension)

module.exports = 'Viewing.Extension.Configurator.Predix'
