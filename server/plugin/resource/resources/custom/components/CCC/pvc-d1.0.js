
var pvc = {}

/**
 *
 *  Utility function for logging messages to the console
 *
 */

pvc.log = function(m){

  if (typeof console != "undefined"){
    console.log("[pvChart]: " + m);
  }
};

/**
 *
 * Evaluates x if it's a function or returns the value otherwise
 *
 */

pvc.ev = function(x){
  return typeof x == "function"?x():x;
};

pvc.sumOrSet = function(v1,v2){
  return typeof v1 == "undefined"?v2:v1+v2;
}

pvc.nonEmpty = function(d){
  return typeof d != "undefined"
  }


/**
 *
 * Implements filter property if not implemented yet
 *
 */
if (!Array.prototype.filter)
{
  Array.prototype.filter = function(fun, thisp)
  {
    var len = this.length >>> 0;
    if (typeof fun != "function")
      throw new TypeError();

    var res = [];
    var thisp = arguments[1];
    for (var i = 0; i < len; i++)
    {
      if (i in this)
      {
        var val = this[i]; // in case fun mutates this
        if (fun.call(thisp, val, i, this))
          res.push(val);
      }
    }

    return res;
  };
}/**
 * The main component
 */


pvc.Base = Base.extend({

  options: {},
  isPreRendered: false,
  isAnimating: false,

  // data
  dataEngine: null,
  resultset:[],
  metadata: [],

  // panels
  basePanel: null,
  titlePanel: null,
  legendPanel: null,

  legendSource: "series",
  colors: null,


  constructor: function(options){
    var myself = this;
    var _defaults = {
      canvas: null,
      width: 400,
      height: 300,
      originalWidth: 400,
      originalHeight: 300,
      crosstabMode: true,
      seriesInRows: false,
      animate: true,

      title: null,
      titlePosition: "top", // options: bottom || left || right
      titleAlign: "center", // left / right / center
      legend: false,
      legendPosition: "bottom",
      colors: null,

      tooltipFormat: function(s,c,v){
        return s+", "+c+":  " + myself.options.valueFormat(v) ;
      },

      valueFormat: function(d){
        return pv.Format.number().fractionDigits(0, 2).format(d)
      },
      clickable: false,
      clickAction: function(s, c, v){
        pvc.log("You clicked on series " + s + ", category " + c + ", value " + v);
      }

    };
    
    this.options = {},

    // Apply options
    $.extend(this.options, _defaults);


  },


  /**
   *
   * Building the visualization has 2 stages: First the preRender prepares and
   * build every object that will be used; Later
   *
   */

  preRender: function(){

    pvc.log("Prerendering in pvc");

    // Firt thing, we need to create the data engine nad initialize the translator
    this.dataEngine = new pvc.DataEngine(this,this.metadata,this.resultset);
    this.dataEngine.setCrosstabMode(this.options.crosstabMode);
    this.dataEngine.setSeriesInRows(this.options.seriesInRows);
    this.dataEngine.createTranslator();

    pvc.log(this.dataEngine.getInfo());

    // Create the color info
    if (typeof this.options.colors == 'undefined' || this.options.colors == null || this.options.colors.length == 0){
      this.colors = pv.Colors.category10;
    }
    else{
      this.colors = function() {
        var scale = pv.colors(this.options.colors);
        scale.domain.apply(scale, arguments);
        return scale;
      };
    }


    // create the basePanel. Since we don't have a parent panel we need to
    // manually create the points

    this.basePanel = new pvc.BasePanel(this); // Base panel, no parent
    this.basePanel.setSize(this.options.width, this.options.height);
    this.basePanel.create();
    this.basePanel.getPvPanel().canvas(this.options.canvas);

    // Title
    if (this.options.title != null && this.options.title.lengh != ""){
      this.titlePanel = new pvc.TitlePanel(this, {
        title: this.options.title,
        anchor: this.options.titlePosition,
        titleSize: this.options.titleSize,
        titleAlign: this.options.titleAlign
      });

      this.titlePanel.appendTo(this.basePanel); // Add it

    }


    // Legend
    if (this.options.legend){
      this.legendPanel = new pvc.LegendPanel(this, {
        anchor: this.options.legendPosition,
        legendSize: this.options.legendSize,
        align: this.options.legendAlign,
        minMarginX: this.options.legendMinMarginX,
        minMarginY: this.options.legendMinMarginY,
        textMargin: this.options.legendTextMargin,
        padding: this.options.legendPadding,
        textAdjust: this.options.legendTextAdjust,
        shape: this.options.legendShape,
        markerSize: this.options.legendMarkerSize,
        drawLine: this.options.legendDrawLine,
        drawMarker: this.options.legendDrawMarker
      });

      this.legendPanel.appendTo(this.basePanel); // Add it

    }

    this.isPreRendered = true;

  },

  /**
   *
   * Render the visualization. If not prerendered, do it now
   *
   */

  render: function(){

    if(!this.isPreRendered){
      this.preRender();
    }

    this.basePanel.getPvPanel().render();
    
    if(this.options.animate == true ){
      this.isAnimating = true;
      this.basePanel.getPvPanel().transition()
      .duration( 2000)
      .ease("cubic-in-out")
      .start();
    }



  },


  /**
   * Method to set the data to the chart. Expected object is the same as what
   * comes from the CDA: {metadata: [], resultset: []}
   */

  setData: function(data, options){
    this.setResultset(data.resultset);
    this.setMetadata(data.metadata);

    $.extend(this.options,options);
  },


  /**
   * Sets the resultset that will be used to build the chart
   */

  setResultset: function(resultset){

    this.resultset = resultset;
    if (resultset.length == 0){
      pvc.log("Warning: Resultset is empty")
    }

  },


  /**
   * Sets the metadata that, optionally, will give more information for building
   * the chart
   */

  setMetadata: function(metadata){

    this.metadata = metadata;
    if (metadata.length == 0){
      pvc.log("Warning: Metadata is empty")
    }

  },

  /*
   * Animation
   */

  animate: function(start, end){

    if (this.options.animate == false || this.isAnimating == true){
      return end;
    }
    else{
      return start
    }

  }



});


/**
 *
 * Base panel. A lot of them will exist here, with some common properties.
 * Each class that extends pvc.base will be responsible to know how to use it
 *
 */
pvc.BasePanel = Base.extend({

  chart: null,
  _parent: null,
  type: pv.Panel, // default one
  height: null,
  width: null,
  anchor: "top",
  pvPanel: null,
  fillColor: "red",
  margins: null,

  constructor: function(chart,options){

    this.chart = chart;
    $.extend(this,options);

    this.margins = {
      top:0,
      right: 0,
      bottom: 0,
      left: 0
    }

  },


  create: function(){

    if(this._parent == null){
      // Should be created for the vis panel only
      this.pvPanel = new pv.Panel();
      this.extend(this.pvPanel,"base_");
    }
    else{
      this.pvPanel = this._parent.pvPanel.add(this.type);
    }

    this.pvPanel
    .width(this.width)
    .height(this.height);

  },


  /*
   *  Create the panel, appending it to the previous one using a specified anchor.
   *
   *  Will:
   *  1) create the panel.
   *  2) subtract it's size from the previous panel's size
   *  3) append it to the previous one in the correct position
   *
   */

  appendTo: function(_parent){

    this._parent = _parent;
    this.create();

    // Reduce size and update margins
    var a = this.anchor;
    if(a == "top" || a == "bottom"){
      this._parent.height -= this.height;
    }
    else{
      this._parent.width -= this.width;
    }


    
    // See where to attach it.
    this.pvPanel[a](this._parent.margins[a]);
    this.pvPanel[pvc.BasePanel.relativeAnchor[a]](this._parent.margins[pvc.BasePanel.relativeAnchor[a]]);

    // update margins
    if(a == "top" || a == "bottom"){
      this._parent.margins[this.anchor] += this.height;
    }
    else{
      this._parent.margins[a] += this.width;
    }

  },


  /**
   *
   * This is the method to be used for the extension points for the specific
   * contents of the chart.
   *already ge a pie chart!
   * Goes through the list of options and, if it matches the prefix, execute that
   * method on the mark. WARNING: It's user's reponsability to make sure some
   * unexisting method won't blow this
   *
   */

  extend: function(mark, prefix){

    for (p in this.chart.options.extensionPoints){
      if (p.indexOf(prefix) == 0){
        var m = p.substring(prefix.length);
        mark[m](this.chart.options.extensionPoints[p]);
      }

    }

  },

  /*
   * Sets the size for the panel, when he parent panel is undefined
   */

  setSize: function(w,h){
    this.width = w;
    this.height = h;

  },

  /*
   * returns the width of the Panel
   */
  getWidth: function(){
    return this.width
  },

  /*
   * returns the height of the Panel
   */
  getHeight: function(){
    return this.height
  },

  /*
   * Returns the underlying protovis Panel
   */
  getPvPanel: function(){
    return this.pvPanel
  }


},{
  // determine what is the associated method to call to position the labels
  // correctly

  relativeAnchor: {
    top: "left",
    bottom: "left",
    left: "bottom",
    right: "bottom"
  },

  oppositeAnchor:{
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left"
  },

  paralelLength:{
    top: "width",
    bottom: "width",
    right: "height",
    left: "height"
  },

  orthogonalLength:{
    top: "height",
    bottom: "height",
    right: "width",
    left: "width"
  }

})


/*
 * Title panel. Generates the title. Specific options are:
 * <i>title</i> - text. Default: null
 * <i>titlePosition</i> - top / bottom / left / right. Default: top
 * <i>titleSize</i> - The size of the title in pixels. Default: 25
 *
 * Has the following protovis extension points:
 *
 * <i>title_</i> - for the title Panel
 * <i>titleLabel_</i> - for the title Label
 */
pvc.TitlePanel = pvc.BasePanel.extend({
  
  _parent: null,
  pvLabel: null,
  anchor: "top",
  titlePanel: null,
  title: null,
  titleSize: 25,
  titleAlign: "center",
  font: "14px sans-serif",



  constructor: function(chart, options){

    this.base(chart,options);

  },

  create: function(){

    // Size will depend on positioning and font size mainly
    
    if (this.anchor == "top" || this.anchor == "bottom"){
      this.width = this._parent.width;
      this.height = this.titleSize;
    }
    else{
      this.height = this._parent.height;
      this.width = this.titleSize;
    }


    this.pvPanel = this._parent.getPvPanel().add(this.type)
    .width(this.width)
    .height(this.height)

    // Extend title
    this.extend(this.pvPanel,"title_");

    var rotation = {
      top: 0,
      right: Math.PI/2,
      bottom: 0,
      left: -Math.PI/2
    };

    // label
    this.pvLabel = this.pvPanel.add(pv.Label)
    .text(this.title)
    .font(this.font)
    .textAlign("center")
    .textBaseline("middle")
    .bottom(this.height/2)
    .left(this.width/2)
    .textAngle(rotation[this.anchor]);

    // Cases:
    if(this.titleAlign == "center"){
      this.pvLabel
      .bottom(this.height/2)
      .left(this.width/2)
    }
    else{

      this.pvLabel.textAlign(this.titleAlign);

      if ( this.anchor == "top" || this.anchor == "bottom"){

        this.pvLabel.bottom(null).left(null); // reset
        this.pvLabel[this.titleAlign](0)
        .bottom(this.height/2)

      }
      else if (this.anchor == "right"){
        this.titleAlign=="left"?this.pvLabel.bottom(null).top(0):this.pvLabel.bottom(0);
      }
      else if (this.anchor == "left"){
        this.titleAlign=="right"?this.pvLabel.bottom(null).top(0):this.pvLabel.bottom(0);
      }
    }


    // Extend title label
    this.extend(this.pvLabel,"titleLabel_");

  }


});
/*
 * Legend panel. Generates the legend. Specific options are:
 * <i>legend</i> - text. Default: false
 * <i>legendPosition</i> - top / bottom / left / right. Default: bottom
 * <i>legendSize</i> - The size of the legend in pixels. Default: 25
 *
 * Has the following protovis extension points:
 *
 * <i>legend_</i> - for the legend Panel
 * <i>legendRule_</i> - for the legend line (when applicable)
 * <i>legendDot_</i> - for the legend marker (when applicable)
 * <i>legendLabel_</i> - for the legend label
 * 
 */
pvc.LegendPanel = pvc.BasePanel.extend({

  _parent: null,
  pvRule: null,
  pvDot: null,
  pvLabel: null,


  anchor: "bottom",
  align: "left",
  legendPanel: null,
  legend: null,
  legendSize: null,
  minMarginX: 8,
  minMarginY: 8,
  textMargin: 6,
  padding: 20,
  textAdjust: 7,
  shape: "square",
  markerSize: 15,
  drawLine: false,
  drawMarker: true,




  constructor: function(chart, options){

    this.base(chart,options);

  },

  create: function(){
    var myself = this;
    var c = this.chart.colors();
    var x,y;


    //pvc.log("Debug PMartins");

    var data = this.chart.legendSource=="series"?
      this.chart.dataEngine.getSeries():
      this.chart.dataEngine.getCategories();



    //determine the size of the biggest cell
    //Size will depend on positioning and font size mainly
    var maxtext = 0;
    for (i in data){
      maxtext = maxtext < data[i].length?data[i].length:maxtext;
    }
    var cellsize = this.markerSize + maxtext*this.textAdjust;

    var realxsize, realysize;


    if (this.anchor == "top" || this.anchor == "bottom"){
      this.width = this._parent.width;
      this.height = this.legendSize;
      var maxperline = data.length;

      //if the legend is bigger than the available size, multi-line and left align
      if(maxperline*(cellsize + this.padding) - this.padding + myself.minMarginX > this.width){
        this.align = "left";
        maxperline = Math.floor((this.width + this.padding - myself.minMarginX)/(cellsize + this.padding));
      }
      realxsize = maxperline*(cellsize + this.padding) + myself.minMarginX - this.padding;
      realysize = myself.padding*(Math.ceil(data.length/maxperline));

      if(this.heigth == null){
        this.height = realysize;
      }

      //changing margins if the alignment is not "left"
      if(this.align == "right"){
        myself.minMarginX = this.width - realxsize;
      }
      else if (this.align == "center"){
        myself.minMarginX = (this.width - realxsize)/2;
      }

      x = function(){
        var n = Math.ceil(this.index/maxperline);
        return (this.index%maxperline)*(cellsize + myself.padding) + myself.minMarginX;
      }
      myself.minMarginY = (myself.height - realysize)/2;
      y = function(){
        var n = Math.floor(this.index/maxperline); 
        return myself.height  - n*myself.padding - myself.minMarginY - myself.padding/2;
      }

    }
    else{
      this.height = this._parent.height;
      this.width = this.legendSize;
      realxsize = cellsize + this.minMarginX;
      realysize = myself.padding*data.length;
      if(this.align == "middle"){
        myself.minMarginY = (myself.height - realysize + myself.padding)/2  ;
      }
      else if (this.align == "bottom"){
        myself.minMarginY = myself.height - realysize;
      }
      x = myself.minMarginX;
      y = function(){return myself.height - this.index*myself.padding - myself.minMarginY;}
    }

    if(this.width == null){
      this.width = realxsize;
    }

    this.pvPanel = this._parent.getPvPanel().add(this.type)
    .width(this.width)
    .height(this.height)    

    //********** Markers and Lines ***************************


    if(this.drawLine == true && this.drawMarker == true){
      
      this.pvRule = this.pvPanel.add(pv.Rule)
      .data(data)
      .width(this.markerSize)
      .lineWidth(1)
      .strokeStyle(function(){return c(this.index);})
      .left(x)
      .bottom(y)

      this.pvDot = this.pvRule.anchor("center").add(pv.Dot)
      .size(this.markerSize)
      .shape(this.shape)
      .lineWidth(0)
      .fillStyle(function(){return c(this.index);})

      this.pvLabel = this.pvDot.anchor("right").add(pv.Label)
      .textMargin(myself.textMargin)
      .font("9px sans-serif")
    }
    else if(this.drawLine == true){
      
      this.pvRule = this.pvPanel.add(pv.Rule)
      .data(data)
      .width(this.markerSize)
      .lineWidth(1)
      .strokeStyle(function(){return c(this.index);})
      .left(x)
      .bottom(y)

      this.pvLabel = this.pvRule.anchor("right").add(pv.Label)
      .textMargin(myself.textMargin)
      .font("9px sans-serif")
    }
    else if(this.drawMarker == true){
      this.pvDot = this.pvPanel.add(pv.Dot)
      .data(data)
      .shapeSize(this.markerSize)
      .shape(this.shape)
      .lineWidth(0)
      .fillStyle(function(){return c(this.index);})
      .left(x)
      .bottom(y)

      this.pvLabel = this.pvDot.anchor("right").add(pv.Label)
      .data(data)
      .textMargin(myself.textMargin)
      .font("9px sans-serif")
    }


    // Extend legend
    this.extend(this.pvPanel,"legend_");
    this.extend(this.pvRule,"legendRule_");
    this.extend(this.pvDot,"legendDot_");
    this.extend(this.pvLabel,"legendLabel_");


  }


});

/**
 * TimeseriesAbstract is the base class for all categorical or timeseries
 */

pvc.TimeseriesAbstract = pvc.Base.extend({

  allTimeseriesPanel : null,

  constructor: function(o){

    this.base();

    var _defaults = {
      showAllTimeseries: true,
      allTimeseriesPosition: "bottom",
      allTimeseriesSize: 50
    };


    // Apply options
    $.extend(this.options,_defaults, o);


  },

  preRender: function(){

    this.base();

    pvc.log("Prerendering in TimeseriesAbstract");


    // Do we have the timeseries panel? add it

    if (this.options.showAllTimeseries){
      this.allTimeseriesPanel = new pvc.AllTimeseriesPanel(this, {
        anchor: this.options.allTimeseriesPosition,
        allTimeseriesSize: this.options.allTimeseriesSize

      });

      this.allTimeseriesPanel.appendTo(this.basePanel); // Add it

    }

  }

}
)


/*
 * AllTimeseriesPanel panel. Generates a small timeseries panel that the user
 * can use to select the range:
 * <i>allTimeseriesPosition</i> - top / bottom / left / right. Default: top
 * <i>allTimeseriesSize</i> - The size of the timeseries in pixels. Default: 100
 *
 * Has the following protovis extension points:
 *
 * <i>allTimeseries_</i> - for the title Panel
 * 
 */
pvc.AllTimeseriesPanel = pvc.BasePanel.extend({

  _parent: null,
  pvAllTimeseriesPanel: null,
  anchor: "bottom",
  allTimeseriesSize: 50,



  constructor: function(chart, options){

    this.base(chart,options);

  },

  create: function(){

    // Size will depend on positioning and font size mainly

    if (this.anchor == "top" || this.anchor == "bottom"){
      this.width = this._parent.width;
      this.height = this.allTimeseriesSize;
    }
    else{
      this.height = this._parent.height;
      this.width = this.allTimeseriesSize;
    }


    this.pvPanel = this._parent.getPvPanel().add(this.type)
    .width(this.width)
    .height(this.height)

    // Extend panel
    this.extend(this.pvPanel,"allTimeseries_");


  }


});



/**
 * CategoricalAbstract is the base class for all categorical or timeseries
 */

pvc.CategoricalAbstract = pvc.TimeseriesAbstract.extend({

  yAxisPanel : null,
  xAxisPanel : null,

  yScale: null,
  xScale: null,


  constructor: function(o){

    this.base();

    var _defaults = {
      showAllTimeseries: false, // meaningless here
      showXScale: true,
      showYScale: true,
      yAxisPosition: "left",
      xAxisPosition: "bottom",
      yAxisSize: 50,
      xAxisSize: 50,
      xAxisFullGrid: false,
      yAxisFullGrid: false
    };


    // Apply options
    $.extend(this.options,_defaults, o);

    // Sanitize some options:
    if (this.options.showYScale == false){
      this.options.yAxisSize = 0
    }
    if (this.options.showXScale == false){
      this.options.xAxisSize = 0
    }


  },

  preRender: function(){


    this.base();

    pvc.log("Prerendering in CategoricalAbstract");

    this.xScale = this.getXScale();
    this.yScale = this.getYScale()


    // Generate axis

    this.generateXAxis();
    this.generateYAxis();


  },


  /*
   * Generates the X axis. It's in a separate function to allow overriding this value
   */

  generateXAxis: function(){

    if (this.options.showXScale){
      this.xAxisPanel = new pvc.XAxisPanel(this, {
        ordinal: this.isXAxisOrdinal(),
        showAllTimeseries: false,
        anchor: this.options.xAxisPosition,
        axisSize: this.options.xAxisSize,
        oppositeAxisSize: this.options.yAxisSize,
        fullGrid:  this.options.xAxisFullGrid,
        elements: this.getAxisOrdinalElements()
      });

      this.xAxisPanel.setScale(this.xScale);
      this.xAxisPanel.appendTo(this.basePanel); // Add it

    }


  },


  /*
   * Generates the Y axis. It's in a separate function to allow overriding this value
   */

  generateYAxis: function(){

    if (this.options.showYScale){
      this.yAxisPanel = new pvc.YAxisPanel(this, {
        ordinal: this.isYAxisOrdinal(),
        showAllTimeseries: false,
        anchor: this.options.yAxisPosition,
        axisSize: this.options.yAxisSize,
        oppositeAxisSize: this.options.xAxisSize,
        fullGrid:  this.options.yAxisFullGrid,
        elements: this.getAxisOrdinalElements()
      });

      this.yAxisPanel.setScale(this.yScale);
      this.yAxisPanel.appendTo(this.basePanel); // Add it

    }

  },


  /*
   * Indicates if xx is an ordinal scale
   */

  isXAxisOrdinal: function(){
    return this.options.orientation == "vertical" && !this.options.timeSeries;
  },


  /*
   * Indicates if yy is an ordinal scale
   */

  isYAxisOrdinal: function(){
    return this.options.orientation == "horizontal" && !this.options.timeSeries;
  },

  /*
   *  List of elements to use in the axis ordinal
   *
   */
  getAxisOrdinalElements: function(){
    return this.dataEngine.getCategories();
  },



  /*
   * xx scale for categorical charts
   */

  getXScale: function(){

    return this.options.orientation == "vertical"?
    (this.options.timeSeries?this.getTimeseriesScale():this.getOrdinalScale()):
    this.getLinearScale();

  },

  /*
   * yy scale for categorical charts
   */

  getYScale: function(){

    return this.options.orientation == "vertical"?
    this.getLinearScale():
    (this.options.timeSeries?this.getTimeseriesScale():this.getOrdinalScale());
  },

  /*
   * Scale for the ordinal axis. xx if orientation is vertical, yy otherwise
   *
   */
  getOrdinalScale: function(){

    var scale = new pv.Scale.ordinal(pv.range(0,this.dataEngine.getCategoriesSize()));

    var size = this.options.orientation=="vertical"?this.basePanel.width:this.basePanel.height;

    if(this.options.orientation=="vertical" && this.options.yAxisPosition == "left"){
      scale.splitBanded( this.options.yAxisSize , size, this.options.panelSizeRatio);
    }
    else if(this.options.orientation=="vertical" && this.options.yAxisPosition == "right"){
      scale.splitBanded(0, size - this.options.yAxisSize, this.options.panelSizeRatio);
    }
    else{
      scale.splitBanded(0, size - this.options.xAxisSize, this.options.panelSizeRatio);
    }

    return scale;



  },

  /*
   * Scale for the linear axis. yy if orientation is vertical, xx otherwise
   *
   */
  getLinearScale: function(){

    var isVertical = this.options.orientation=="vertical"
    var size = isVertical?this.basePanel.height:this.basePanel.width;

    var max, min;

    if(this.options.stacked){
      max = this.dataEngine.getCategoriesMaxSum();
      min = 0;
    }
    else{
      max = this.dataEngine.getSeriesAbsoluteMax();
      min = this.dataEngine.getSeriesAbsoluteMin();

    }
    if(min > 0 && this.options.originIsZero){
      min = 0
    }

    // Adding a small offset to the scale:
    var offset = (max - min) * this.options.axisOffset;
    var scale = new pv.Scale.linear(min - offset,max + offset)


    if( !isVertical && this.options.yAxisPosition == "left"){
      scale.range( this.options.yAxisSize , size);
    }
    else if( !isVertical && this.options.yAxisPosition == "right"){
      scale.range(0, size - this.options.yAxisSize);
    }
    else{
      scale.range(0, size - this.options.xAxisSize);
    }

    return scale

  },

  /*
   * Scale for the timeseries axis. xx if orientation is vertical, yy otherwise
   *
   */
  getTimeseriesScale: function(){


    var size = this.options.orientation=="vertical"?
    this.basePanel.width:
    this.basePanel.height - this.options.xAxisSize;

    var parser = pv.Format.date(this.options.timeSeriesFormat);
    var categories =  this.dataEngine.getCategories().sort(function(a,b){
      return parser.parse(a) - parser.parse(b)
    });


    // Adding a small offset to the scale:
    var max = parser.parse(categories[categories.length -1]);
    var min = parser.parse(categories[0]);
    var offset = (max.getTime() - min.getTime()) * this.options.axisOffset;

    var scale = new pv.Scale.linear(new Date(min.getTime() - offset),new Date(max.getTime() + offset));

    if(this.options.orientation=="vertical" && this.options.yAxisPosition == "left"){
      scale.range( this.options.yAxisSize , size);
    }
    else if(this.options.orientation=="vertical" && this.options.yAxisPosition == "right"){
      scale.range(0, size - this.options.yAxisSize);
    }
    else{
      scale.range(0, size - this.options.xAxisSize);
    }

    return scale;


  }




}
)


/*
 * AxisPanel panel.
 *
 * 
 */
pvc.AxisPanel = pvc.BasePanel.extend({

  _parent: null,
  pvRule: null,
  pvLabel: null,
  pvGrid: null,

  ordinal: false,
  anchor: "bottom",
  axisSize: 30,
  tickLength: 6,
  oppositeAxisSize: 30,
  panelName: "axis", // override
  scale: null,
  fullGrid: false,
  elements: [], // To be used in ordinal scales


  constructor: function(chart, options){

    this.base(chart,options);

  },

  create: function(){

    // Size will depend only on the existence of the labels


    if (this.anchor == "top" || this.anchor == "bottom"){
      this.width = this._parent.width;
      this.height = this.axisSize;
    }
    else{
      this.height = this._parent.height;
      this.width = this.axisSize;
    }


    this.pvPanel = this._parent.getPvPanel().add(this.type)
    .width(this.width)
    .height(this.height)

    this.renderAxis();

    // Extend panel
    this.extend(this.pvPanel, this.panelName + "_");
    this.extend(this.pvRule, this.panelName + "Rule_");
    this.extend(this.pvLabel, this.panelName + "Label_");
    this.extend(this.pvGrid, this.panelName + "Grid_");

  },


  setScale: function(scale){
    this.scale = scale;
  },

  renderAxis: function(){

    this.pvRule = this.pvPanel
    .add(pv.Rule)
    .strokeStyle("#aaa")
    [pvc.BasePanel.oppositeAnchor[this.anchor]](0)
    [pvc.BasePanel.relativeAnchor[this.anchor]](this.scale.range()[0])
    [pvc.BasePanel.paralelLength[this.anchor]](this.scale.range()[1])

    if (this.ordinal == true){
      this.renderOrdinalAxis();
    }
    else{
      this.renderLinearAxis();
      
    }
    
  },
  

  renderOrdinalAxis: function(){

    var myself = this;
    
    this.pvLabel = this.pvRule.add(pv.Label)
    .data(this.elements)
    [pvc.BasePanel.paralelLength[this.anchor]](null)
    [pvc.BasePanel.oppositeAnchor[this.anchor]](10)
    [pvc.BasePanel.relativeAnchor[this.anchor]](function(d){
      return myself.scale(this.index) + myself.scale.range().band/2;
    })
    .textAlign("center")
    .textBaseline("middle")
    .text(pv.identity)
    .font("9px sans-serif")
  },


  renderLinearAxis: function(){

    var myself = this;
    
    var scale = this.scale;

    this.pvLabel = this.pvRule.add(pv.Rule)
    .data(this.scale.ticks())
    [pvc.BasePanel.paralelLength[this.anchor]](null)
    [pvc.BasePanel.oppositeAnchor[this.anchor]](0)
    [pvc.BasePanel.relativeAnchor[this.anchor]](this.scale)
    [pvc.BasePanel.orthogonalLength[this.anchor]](function(d){
      return myself.tickLength/(this.index%2 + 1)
    })
    .anchor(this.anchor)
    .add(pv.Label)
    .text(scale.tickFormat)
    .font("9px sans-serif")
    .visible(function(d){
      // mini grids
      if (this.index % 2){
        return false;
      }
      // also, hide the first and last ones
      if( scale(d) == 0  || scale(d) == scale.range()[1] ){
        return false;
      }
      return true;
    })


    // Now do the full grids
    if(this.fullGrid){

      this.pvRuleGrid = this.pvRule.add(pv.Rule)
      .data(scale.ticks())
      .strokeStyle("#f0f0f0")
      [pvc.BasePanel.paralelLength[this.anchor]](null)
      [pvc.BasePanel.oppositeAnchor[this.anchor]](- this._parent[pvc.BasePanel.orthogonalLength[this.anchor]] +
        this[pvc.BasePanel.orthogonalLength[this.anchor]])
      [pvc.BasePanel.relativeAnchor[this.anchor]](scale)
      [pvc.BasePanel.orthogonalLength[this.anchor]](this._parent[pvc.BasePanel.orthogonalLength[this.anchor]] -
        this[pvc.BasePanel.orthogonalLength[this.anchor]])
      .visible(function(d){
        // mini grids
        if (this.index % 2){
          return false;
        }
        // also, hide the first and last ones
        if( scale(d) == 0  || scale(d) == scale.range()[1] ){
          return false;
        }
        return true;
      })
    }


  }



});

/*
 * XAxisPanel panel.
 *
 *
 */
pvc.XAxisPanel = pvc.AxisPanel.extend({

  anchor: "bottom",
  panelName: "xAxis",

  constructor: function(chart, options){

    this.base(chart,options);

  }

});


/*
 * YAxisPanel panel.
 *
 *
 */
pvc.YAxisPanel = pvc.AxisPanel.extend({

  anchor: "left",
  panelName: "yAxis",
  pvRule: null,

  constructor: function(chart, options){

    this.base(chart,options);

  }



});


/**
 * PieChart is the main class for generating... pie charts (surprise!).
 */

pvc.PieChart = pvc.Base.extend({

  pieChartPanel : null,
  legendSource: "categories",

  constructor: function(o){

    this.base();

    var _defaults = {
      showValues: true,
      innerGap: 0.9,
      explodedSliceRadius: 0,
      explodedSliceIndex: null,
      tooltipFormat: function(s,c,v){
        return c+":  " + v;
      }
    };


    // Apply options
    $.extend(this.options,_defaults, o);


  },

  preRender: function(){

    this.base();

    pvc.log("Prerendering in pieChart");


    this.pieChartPanel = new pvc.PieChartPanel(this, {
      innerGap: this.options.innerGap,
      explodedSliceRadius: this.options.explodedSliceRadius,
      explodedSliceIndex: this.options.explodedSliceIndex,
      showValues: this.options.showValues
    });

    this.pieChartPanel.appendTo(this.basePanel); // Add it

  }

}
);


/*
 * Pie chart panel. Generates a pie chart. Specific options are:
 * <i>showValues</i> - Show or hide slice value. Default: false
 * <i>explodedSliceIndex</i> - Index of the slice to explode. Default: null
 * <i>explodedSliceRadius</i> - If one wants a pie with an exploded effect,
 *  specify a value in pixels here. If above argument is specified, explodes
 *  only one slice. Else explodes all. Default: 0
 * <i>innerGap</i> - The percentage of the inner area used by the pie. Default: 0.9 (90%)
 *
 * Has the following protovis extension points:
 *
 * <i>chart_</i> - for the main chart Panel
 * <i>pie_</i> - for the main pie wedge
 * <i>pieLabel_</i> - for the main pie label
 */


pvc.PieChartPanel = pvc.BasePanel.extend({

  _parent: null,
  pvPie: null,
  pvPieLabel: null,
  data: null,

  innerGap: 0.9,
  explodedSliceRadius: 0,
  explodedSliceIndex: null,
  showValues: true,


  constructor: function(chart, options){

    this.base(chart,options);

  },

  create: function(){

    var myself=this;
    this.width = this._parent.width;
    this.height = this._parent.height;

    this.pvPanel = this._parent.getPvPanel().add(this.type)
    .width(this.width)
    .height(this.height)


    // Add the chart. For a pie chart we have one series only

    var r = pv.min([this.width, this.height])/2 * this.innerGap;

    var sum = this.chart.dataEngine.getSeriesMaxSum();
    
    pvc.log("Radius: "+ r + "; Maximum sum: " + sum);

    var a = pv.Scale.linear(0, sum).range(0, 2 * Math.PI);
    this.data = this.chart.dataEngine.getValuesForSeriesIdx(0);


    this.pvPie = this.pvPanel.add(pv.Wedge)
    .data(this.chart.dataEngine.getValuesForSeriesIdx(0))
    .bottom(function(d){
      return myself.explodeSlice("cos", a, this.index);
    })
    .left(function(d){
      return myself.explodeSlice("sin", a, this.index);
    })
    .outerRadius(function(d){
      return myself.chart.animate(0 , r)
    })
    .fillStyle(this.chart.colors().by(pv.index))
    .angle(function(d){
      return a(d)
    })
    .title(function(d){
      var v = myself.chart.options.valueFormat(d);
      var s = myself.chart.dataEngine.getSeries()[this.parent.index]
      var c = myself.chart.dataEngine.getCategories()[this.index]
      return myself.chart.options.tooltipFormat(s,c,v);
    })
    .event("mouseover", pv.Behavior.tipsy({
      gravity: "s",
      fade: true
    }));


    if (this.chart.options.clickable){
      this.pvPie
      .cursor("pointer")
      .event("click",function(d){
        var s = myself.chart.dataEngine.getSeries()[this.parent.index]
        var c = myself.chart.dataEngine.getCategories()[this.index]
        return myself.chart.options.clickAction(s,c, d);
      });
    }

    // Extend pie
    this.extend(this.pvPie,"pie_");


    this.pvPieLabel = this.pvPie.anchor("outer").add(pv.Label)
    //.textAngle(0)
    .text(function(d){
      return " "+ d.toFixed(2)
    })
    .textMargin(10)
    .visible(this.showValues);

    // Extend pieLabel
    this.extend(this.pvPieLabel,"pieLabel_");


    // Extend body
    this.extend(this.pvPanel,"chart_");


  },

  accumulateAngle: function(a,idx){

    var arr = this.data.slice(0,idx);
    arr.push(this.data[idx]/2);
    var angle = a(pv.sum(arr));
    return angle;

  },

  explodeSlice: function(fun, a, idx){

    var size = 0;
    if(this.explodedSliceIndex == null){
      size = this.explodedSliceRadius
    }
    else{
      size = this.explodedSliceIndex==idx?this.explodedSliceRadius:0;
    }
    return (fun=="cos"?this.height:this.width)/2 + size*Math[fun](this.accumulateAngle(a,idx));

  }

});


/**
 * BarChart is the main class for generating... bar charts (another surprise!).
 */

pvc.BarChart = pvc.CategoricalAbstract.extend({

  barChartPanel : null,

  constructor: function(o){

    this.base();

    var _defaults = {
      showValues: true,
      stacked: false,
      panelSizeRatio: 0.9,
      barSizeRatio: 0.9,
      maxBarSize: 2000,
      originIsZero: true,
      axisOffset: 0.05,
      orientation: "vertical"
    };


    // Apply options
    $.extend(this.options,_defaults, o);


  },

  preRender: function(){

    this.base();

    pvc.log("Prerendering in barChart");


    this.barChartPanel = new pvc.BarChartPanel(this, {
      stacked: this.options.stacked,
      panelSizeRatio: this.options.panelSizeRatio,
      barSizeRatio: this.options.barSizeRatio,
      maxBarSize: this.options.maxBarSize,
      showValues: this.options.showValues,
      orientation: this.options.orientation
    });

    this.barChartPanel.appendTo(this.basePanel); // Add it

  }

}
);


/*
 * Bar chart panel. Generates a bar chart. Specific options are:
 * <i>orientation</i> - horizontal or vertical. Default: vertical
 * <i>showValues</i> - Show or hide bar value. Default: false
 * <i>stacked</i> -  Stacked? Default: false
 * <i>panelSizeRatio</i> - Ratio of the band occupied by the pane;. Default: 0.5 (50%)
 * <i>barSizeRatio</i> - In multiple series, percentage of inner
 * band occupied by bars. Default: 0.5 (50%)
 * <i>maxBarSize</i> - Maximum size of a bar in pixels. Default: 2000
 *
 * Has the following protovis extension points:
 *
 * <i>chart_</i> - for the main chart Panel
 * <i>bar_</i> - for the actual bar
 * <i>barPanel_</i> - for the panel where the bars sit
 * <i>barLabel_</i> - for the main bar label
 */


pvc.BarChartPanel = pvc.BasePanel.extend({

  _parent: null,
  pvBar: null,
  pvBarLabel: null,
  pvCategoryPanel: null,
  data: null,

  stacked: false,
  panelSizeRatio: 1,
  barSizeRatio: 0.5,
  maxBarSize: 200,
  showValues: true,
  orientation: "vertical",


  constructor: function(chart, options){

    this.base(chart,options);

  },

  create: function(){

    var myself = this;
    this.width = this._parent.width;
    this.height = this._parent.height;

    this.pvPanel = this._parent.getPvPanel().add(this.type)
    .width(this.width)
    .height(this.height)

    var anchor = this.orientation == "vertical"?"bottom":"left";

    // Extend body, resetting axisSizes
    this.chart.options.yAxisSize = 0;
    this.chart.options.xAxisSize = 0;

    var lScale = this.chart.getLinearScale();
    var oScale = this.chart.getOrdinalScale();
    
    
    var maxBarSize;


    // Stacked?
    if (this.stacked){


      maxBarSize = oScale.range().band;
      var bScale = new pv.Scale.ordinal([0])
      .splitBanded(0, oScale.range().band, this.barSizeRatio);


      var barPositionOffset = 0;
      if (maxBarSize > this.maxBarSize){
        barPositionOffset = (maxBarSize - this.maxBarSize)/2 ;
        maxBarSize = this.maxBarSize;
      }
      
     
      this.pvBarPanel = this.pvPanel.add(pv.Layout.Stack)
      /*
      .orient(anchor)
      .order("inside-out")
      .offset("wiggle")*/
      .layers(this.chart.dataEngine.getTransposedValues())
      [this.orientation == "vertical"?"y":"x"](function(d){
        return myself.chart.animate(0, lScale(d||0))
      })
      [this.orientation == "vertical"?"x":"y"](oScale.by(pv.index))

      this.pvBar = this.pvBarPanel.layer.add(pv.Bar)
      .data(function(d){
        return d||0
      })
      [pvc.BasePanel.paralelLength[anchor]](maxBarSize)
      .fillStyle(this.chart.colors().by(pv.parent))

    /*[pvc.BasePanel.relativeAnchor[anchor]](function(d){
        return this.parent.left() + barPositionOffset
      })*/;

    }
    else{

      var bScale = new pv.Scale.ordinal(pv.range(0,this.chart.dataEngine.getSeriesSize()))
      .splitBanded(0, oScale.range().band, this.barSizeRatio);

      // We need to take into account the maxValue if our band is higher than that
      maxBarSize = bScale.range().band;
      var barPositionOffset = 0;
      if (maxBarSize > this.maxBarSize){
        barPositionOffset = (maxBarSize - this.maxBarSize)/2 ;
        maxBarSize = this.maxBarSize;
      }

      this.pvBarPanel = this.pvPanel.add(pv.Panel)
      .data(pv.range(0,this.chart.dataEngine.getCategoriesSize()))
      [pvc.BasePanel.relativeAnchor[anchor]](function(d){
        return oScale(this.index) + barPositionOffset;
      })
      [anchor](0)
      [pvc.BasePanel.paralelLength[anchor]](oScale.range().band)
      [pvc.BasePanel.orthogonalLength[anchor]](this[pvc.BasePanel.orthogonalLength[anchor]])


      this.pvBar = this.pvBarPanel.add(pv.Bar)
      .data(function(d){
        return myself.chart.dataEngine.getValuesForCategoryIdx(d)
        })
      .fillStyle(this.chart.colors().by(pv.index))
      [pvc.BasePanel.relativeAnchor[anchor]](function(d){
        return bScale(this.index) + barPositionOffset;
      })
      [anchor](0)
      [pvc.BasePanel.orthogonalLength[anchor]](function(d){
        return myself.chart.animate(0, lScale(d||0))
      })
      [pvc.BasePanel.paralelLength[anchor]](maxBarSize)

    }
    // Labels:

    this.pvBar
    .title(function(d){
      var v = myself.chart.options.valueFormat(d);
      var s = myself.chart.dataEngine.getSeries()[myself.stacked?this.parent.index:this.index]
      var c = myself.chart.dataEngine.getCategories()[myself.stacked?this.index:this.parent.index]
      return myself.chart.options.tooltipFormat(s,c, v);
    
    })
    .event("mouseover", pv.Behavior.tipsy({
      gravity: "s",
      fade: true
    }));

    if (this.chart.options.clickable){
      this.pvBar
      .cursor("pointer")
      .event("click",function(d){
        var s = myself.chart.dataEngine.getSeries()[myself.stacked?this.parent.index:this.index]
        var c = myself.chart.dataEngine.getCategories()[myself.stacked?this.index:this.parent.index]
        return myself.chart.options.clickAction(s,c, d);
      });
    }

    if(this.showValues){
      this.pvBarLabel = this.pvBar
      .anchor("center")
      .add(pv.Label)
      .bottom(0)
      .text(pv.identity)

      // Extend barLabel
      this.extend(this.pvBarLabel,"barLabel_");
    }


    // Extend bar and barPanel
    this.extend(this.pvBar,"barPanel_");
    this.extend(this.pvBar,"bar_");
    

    // Extend body
    this.extend(this.pvPanel,"chart_");

  }

});


/**
 * ScatterAbstract is the class that will be extended by dot, line, stackedline and area charts.
 */

pvc.ScatterAbstract = pvc.CategoricalAbstract.extend({

  scatterChartPanel : null,

  constructor: function(o){

    this.base();

    var _defaults = {
      showDots: false,
      showLines: false,
      showAreas: false,
      showValues: false,
      axisOffset: 0.05,
      valuesAnchor: "right",
      stacked: false,
      originIsZero: true,
      orientation: "vertical",
      timeSeries: false,
      timeSeriesFormat: "%Y-%m-%d",
      panelSizeRatio: 1
    };


    // Apply options
    $.extend(this.options,_defaults, o);


  },

  preRender: function(){

    this.base();

    pvc.log("Prerendering in ScatterAbstract");


    this.scatterChartPanel = new pvc.ScatterChartPanel(this, {
      stacked: this.options.stacked,
      showValues: this.options.showValues,
      valuesAnchor: this.options.valuesAnchor,
      showLines: this.options.showLines,
      showDots: this.options.showDots,
      showAreas: this.options.showAreas,
      orientation: this.options.orientation,
      timeSeries: this.options.timeSeries,
      timeSeriesFormat: this.options.timeSeriesFormat
    });

    this.scatterChartPanel.appendTo(this.basePanel); // Add it

  }

}
);

/**
 * Dot Chart
 *
 */

pvc.DotChart = pvc.ScatterAbstract.extend({

  constructor: function(o){

    this.base();

    var _defaults = {
      showDots: true,
      showLines: false,
      showAreas: false,
      showValues: false,
      stacked: false
    };

    // Apply options
    $.extend(this.options,_defaults, o);

  }
});


/**
 * Line Chart
 *
 */

pvc.LineChart = pvc.ScatterAbstract.extend({

  constructor: function(o){

    this.base();

    var _defaults = {
      showDots: false, // ask
      showLines: true,
      showAreas: false,
      showValues: false,
      stacked: false
    };

    // Apply options
    $.extend(this.options,_defaults, o);


  }
});



/**
 * Stacked Line Chart
 *
 */

pvc.StackedLineChart = pvc.ScatterAbstract.extend({

  constructor: function(o){

    this.base();

    var _defaults = {
      showDots: false, // ask
      showLines: true,
      showAreas: false,
      showValues: false,
      stacked: true
    };

    // Apply options
    $.extend(this.options,_defaults, o);


  }
});


/**
 * Stacked Area Chart
 *
 */

pvc.StackedAreaChart = pvc.ScatterAbstract.extend({

  constructor: function(o){

    this.base();

    var _defaults = {
      showDots: false, // ask
      showLines: false,
      showAreas: true,
      showValues: false,
      stacked: true
    };

    // Apply options
    $.extend(this.options,_defaults, o);


  }
});



/*
 * Scatter chart panel. Base class for generating the other xy charts. Specific options are:
 * <i>orientation</i> - horizontal or vertical. Default: vertical
 * <i>showDots</i> - Show or hide dots. Default: true
 * <i>showValues</i> - Show or hide line value. Default: false
 * <i>stacked</i> -  Stacked? Default: false
 * <i>panelSizeRatio</i> - Ratio of the band occupied by the pane;. Default: 0.5 (50%)
 * <i>lineSizeRatio</i> - In multiple series, percentage of inner
 * band occupied by lines. Default: 0.5 (50%)
 * <i>maxLineSize</i> - Maximum size of a line in pixels. Default: 2000
 *
 * Has the following protovis extension points:
 *
 * <i>chart_</i> - for the main chart Panel
 * <i>line_</i> - for the actual line
 * <i>linePanel_</i> - for the panel where the lines sit
 * <i>lineDot_</i> - the dots on the line
 * <i>lineLabel_</i> - for the main line label
 */


pvc.ScatterChartPanel = pvc.BasePanel.extend({

  _parent: null,
  pvLine: null,
  pvArea: null,
  pvDot: null,
  pvLabel: null,
  pvCategoryPanel: null,
  data: null,

  timeSeries: false,
  timeSeriesFormat: "%Y-%m-%d",

  stacked: false,
  showAreas: false,
  showLines: true,
  showDots: true,
  showValues: true,
  valuesAnchor: "right",
  orientation: "vertical",


  constructor: function(chart, options){

    this.base(chart,options);

  },

  create: function(){

    this.chart.basePanel.pvPanel
    .events("all")
    .event("mousemove", pv.Behavior.point(Infinity));

    var myself = this;
    this.width = this._parent.width;
    this.height = this._parent.height;

    this.pvPanel = this._parent.getPvPanel().add(this.type)
    .width(this.width)
    .height(this.height)

    var anchor = this.orientation == "vertical"?"bottom":"left";

    // Extend body, resetting axisSizes
    this.chart.options.yAxisSize = 0;
    this.chart.options.xAxisSize = 0;

    var lScale = this.chart.getLinearScale();
    var oScale = this.chart.getOrdinalScale();
    var tScale = this.chart.getTimeseriesScale();
    var parser = pv.Format.date(this.timeSeriesFormat);
    
    var maxLineSize;


    // Stacked?
    if (this.stacked){
      
      this.pvScatterPanel = this.pvPanel.add(pv.Layout.Stack)
      .layers(this.chart.dataEngine.getTransposedValues())
      [this.orientation == "vertical"?"x":"y"](function(){
        if(myself.timeSeries){
          return tScale(parser.parse(myself.chart.dataEngine.getCategories()[this.index]));
        }
        else{
          return oScale(myself.chart.dataEngine.getCategories()[this.index]) + oScale.range().band/2;
        }
      })
      [this.orientation == "vertical"?"y":"x"](function(d){
        return myself.chart.animate(0,lScale(d));
      })

      this.pvArea = this.pvScatterPanel.layer.add(pv.Area)
      .fillStyle(this.showAreas?this.chart.colors().by(pv.parent):null);

      this.pvLine = this.pvArea.anchor(pvc.BasePanel.oppositeAnchor[anchor]).add(pv.Line)
      .lineWidth(this.showLines?1.5:0);
    //[pvc.BasePanel.paralelLength[anchor]](maxLineSize)
      
    }
    else{

      this.pvScatterPanel = this.pvPanel.add(pv.Panel)
      .data(pv.range(0,this.chart.dataEngine.getSeriesSize()))

      this.pvArea = this.pvScatterPanel.add(pv.Area)
      .fillStyle(this.showAreas?this.chart.colors().by(pv.parent):null);

      this.pvLine = this.pvArea.add(pv.Line)
      .data(function(d){
        return myself.chart.dataEngine.getObjectsForSeriesIdx(d, this.timeSeries?function(a,b){
          return parser.parse(a.category) - parser.parse(b.category);
          }: null)
        })
      .lineWidth(this.showLines?1.5:0)
      [pvc.BasePanel.relativeAnchor[anchor]](function(d){

        if(myself.timeSeries){
          return tScale(parser.parse(d.category));
        }
        else{
          return oScale(d.category) + oScale.range().band/2;
        }

      })
      [anchor](function(d){
        return myself.chart.animate(0,lScale(d.value));
      })
   

    }

    this.pvLine
    .strokeStyle(this.chart.colors().by(pv.parent))
    .text(function(d){
      var v, c;
      var s = myself.chart.dataEngine.getSeries()[this.parent.index]
      if( typeof d == "object"){
        v = d.value;
        c = d.category
      }
      else{
        v = d
        c = myself.chart.dataEngine.getCategories()[this.index]
      };
      return myself.chart.options.tooltipFormat(s,c,v);
    })
    .event("point", pv.Behavior.tipsy({
      gravity: "s",
      fade: true
    }));


    this.pvDot = this.pvLine.add(pv.Dot)
    .shapeSize(20)
    .lineWidth(1.5)
    .strokeStyle(this.showDots?this.chart.colors().by(pv.parent):null)
    .fillStyle(this.showDots?"white":null)
    

    if (this.chart.options.clickable){
      this.pvDot
      .cursor("pointer")
      .event("click",function(d){
        var v, c;
        var s = myself.chart.dataEngine.getSeries()[this.parent.index]
        if( typeof d == "object"){
          v = d.value;
          c = d.category
        }
        else{
          v = d
          c = myself.chart.dataEngine.getCategories()[this.index]
        }
        return myself.chart.options.clickAction(s,c, v);
      });
    }



    if(this.showValues){
      this.pvLabel = this.pvDot
      .anchor(this.valuesAnchor)
      .add(pv.Label)
      .bottom(0)
      .text(function(d){
        return myself.chart.options.valueFormat(typeof d == "object"?d.value:d)
      })

      // Extend lineLabel
      this.extend(this.pvLabel,"lineLabel_");
    }


    // Extend line and linePanel
    this.extend(this.pvScatterPanel,"scatterPanel_");
    this.extend(this.pvArea,"area_");
    this.extend(this.pvLine,"line_");
    this.extend(this.pvDot,"dot_");
    this.extend(this.pvLabel,"label_");


    // Extend body
    this.extend(this.pvPanel,"chart_");

  }

});
/**
 *
 * Base panel. A lot of them will exist here, with some common properties.
 * Each class that extends pvc.base will be responsible to know how to use it
 *
 */
pvc.DataEngine = Base.extend({

  chart: null,
  metadata: null,
  resultset: null,
  seriesInRows: false,
  crosstabMode: true,
  translator: null,
  series: null,
  categories: null,
  values: null,

  constructor: function(chart,metadata, resultset){

    this.chart = chart;
    this.metadata = metadata;
    this.resultset = resultset;

    
  },

  /**
   * Creates the appropriate translator
   */

  createTranslator: function(){

    // Create the appropriate translator
    if(this.crosstabMode){
      pvc.log("Creating CrosstabTranslator");
      this.translator = new pvc.CrosstabTranslator();
    }
    else{
      pvc.log("Creating RelationalTranslator");
      this.translator = new pvc.RelationalTranslator();
    }

    this.translator.setData(this.metadata, this.resultset);
    this.translator.prepare();
    if( this.seriesInRows ){
      this.translator.transpose()
    }


  },

  /*
   * Returns some information on the data points
   */

  getInfo: function(){

    var out = "------------------------------------------\n";
    out+= "Dataset Information\n";

    out+= "  Series ( "+ this.getSeriesSize() +" ): " + this.getSeries().slice(0,10) +"\n";
    out+= "  Categories ( "+ this.getCategoriesSize() +" ): " + this.getCategories().slice(0,10) +"\n";
    out+= "------------------------------------------\n";

    return out;

  },

  /*
   * Returns the series on the underlying data
   *
   */

  getSeries: function(){
    return this.series || this.translator.getColumns();
  },

  /*
   * Returns the categories on the underlying data
   *
   */

  getCategories: function(){
    return this.categories || this.translator.getRows();
  },

  /*
   * Returns the values for the dataset
   */

  getValues: function(){


    if (this.values == null){
      this.values = this.translator.getValues();
    }
    return this.values;

  },

   /*
   * Returns the transposed values for the dataset
   */

  getTransposedValues: function(){


    return pv.transpose(this.getValues().slice());

  },

  /*
   * Returns the values for a given series idx
   *
   */

  getValuesForSeriesIdx: function(idx){
    return this.getValues().map(function(a){
      return a[idx];
    })
  },

  /*
   * Returns the object for a given series idx in the form {category: catName, value: val}
   *
   */

  getObjectsForSeriesIdx: function(idx, sortF){

    var myself = this;
    var ar = [];
    this.getValues().map(function(a,i){
      if(typeof a[idx] != "undefined"){
          ar.push({category: myself.getCategories()[i], value: a[idx]}) ;
      }
    })

    if (typeof sortF == "function"){
      return ar.sort(sortF)
    }
    else
      return ar;
  },

  /*
   * Returns the values for a given category idx
   *
   */

  getValuesForCategoryIdx: function(idx){
    return this.getValues()[idx];
  },


  /*
   * Returns the object for a given category idx in the form {serie: value}
   *
   */

  getObjectsForCategoryIdx: function(idx){

    var myself = this;
    var ar=[];
    this.getValues()[idx].map(function(a,i){
      if(typeof a != "undefined"){
          ar.push({serie: myself.getSeries()[i], value: a}) ;
      }
    })
    return ar;
  },

  /*
   * Returns how many series we have
   */

  getSeriesSize: function(){
    return this.getSeries().length;
  },

  /*
   * Returns how many categories, or data points, we have
   */
  getCategoriesSize: function(){
    return this.getCategories().length;
  },

  /**
   * For every category in the data, get the maximum of the sum of the series
   * values.
   *
   */

  getCategoriesMaxSum: function(){

    var myself=this;
    return pv.max(pv.range(0,this.getCategoriesSize()).map(function(idx){
      return pv.sum(myself.getValuesForCategoryIdx(idx))
    }));
  },

  /**
   * For every serie in the data, get the maximum of the sum of the category
   * values. If only one serie, gets the sum of the value. Useful to build
   * pieCharts
   *
   */

  getSeriesMaxSum: function(){

    var myself=this;
    return pv.max(pv.range(0,this.getSeriesSize()).map(function(idx){
      return pv.sum(myself.getValuesForSeriesIdx(idx))
    }));
  },

  /*
   * Get the maximum value in all series
   */
  getSeriesAbsoluteMax: function(){

    var myself=this;
    return pv.max(pv.range(0,this.getSeriesSize()).map(function(idx){
      return pv.max(myself.getValuesForSeriesIdx(idx).filter(pvc.nonEmpty))
    }));

  },

  /*
   * Get the minimum value in all series
   */
  getSeriesAbsoluteMin: function(){

    var myself=this;
    return pv.min(pv.range(0,this.getSeriesSize()).map(function(idx){
      return pv.min(myself.getValuesForSeriesIdx(idx).filter(pvc.nonEmpty))
    }));

  },


  setCrosstabMode: function(crosstabMode){
    this.crosstabMode = crosstabMode;
  },

  isCrosstabMode: function(){
    return this.crosstabMode;
  },

  setSeriesInRows: function(seriesInRows){
    this.seriesInRows = seriesInRows;
  },

  isSeriesInRows: function(){
    return this.seriesInRows;
  },

  resetDataCache: function(){
    this.series = null;
    this.categories = null;
    this.values = null;
  }

});



pvc.DataTranslator = Base.extend({

  metadata: null,
  resultset: null,
  values: null,

  constructor: function(){
  },


  setData: function(metadata, resultset){
    this.metadata = metadata;
    this.resultset = resultset;
  },


  getValues: function(){


    // Skips first row, skips first col.
    return this.values.slice(1).map(function(a){
      return a.slice(1);
    });
      
  },

  getColumns: function(){

    // First column of every row, skipping 1st entry
    return this.values[0].slice(1);
  },

  getRows: function(){


    // first element of every row, skipping 1st one
    return this.values.slice(1).map(function(d){
      return d[0];
    })


  },

  transpose: function(){

     pv.transpose(this.values);
  },


  prepare: function(){
  // Specific code goes here - override me
  },

  sort: function(sortFunc){
  // Specify the sorting data - override me
  }


})


pvc.CrosstabTranslator = pvc.DataTranslator.extend({


  prepare: function(){
    
    // All we need to do is to prepend to the result's matrix the series
    // line

    var a1 = this.metadata.slice(1).map(function(d){
      return d.colName;
    });
    a1.splice(0,0,"x");

    this.values = this.resultset;
    this.values.splice(0,0,a1);

  }
  
});


pvc.RelationalTranslator = pvc.DataTranslator.extend({



  prepare: function(){

    var myself = this;

    if(this.metadata.length == 2){
      // Adding a static serie
      this.resultset.map(function(d){
        d.splice(0,0,"Serie");
      })
    }

    var tree = pv.tree(this.resultset).keys(function(d){
      return [d[0],d[1]]
    }).map();

    // Now, get series and categories:
    var numeratedSeries = pv.numerate(pv.keys(tree));
    var numeratedCategories = pv.numerate(pv.uniq(pv.blend(pv.values(tree).map(function(d){
      return pv.keys(d)
    }))))

    // Finally, itetate through the resultset and build the new values

    this.values = [];
    var categoriesLength = pv.keys(numeratedCategories).length;
    var seriesLength = pv.keys(numeratedSeries).length;

    // Initialize array
    pv.range(0,categoriesLength).map(function(d){
      myself.values[d] = new Array(seriesLength + 1);
      myself.values[d][0] = pv.keys(numeratedCategories)[d]
    })

    this.resultset.map(function(l){

      myself.values[numeratedCategories[l[1]]][numeratedSeries[l[0]] + 1] =
      pvc.sumOrSet(myself.values[numeratedCategories[l[1]]][numeratedSeries[l[0]]+1], l[2]);
    })

    // Create an inicial line with the categories
    var l1 = pv.keys(numeratedSeries);
    l1.splice(0,0,"x");
    this.values.splice(0,0, l1)


  }


});