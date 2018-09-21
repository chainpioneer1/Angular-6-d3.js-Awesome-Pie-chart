declare var require: any
import { Component, OnInit, EventEmitter, Input, ElementRef } from '@angular/core';

import * as d3 from 'd3';
import * as d3Scale from 'd3-scale';
import * as d3Shape from 'd3-shape';

import * as $ from 'jquery';
import { POPULATION } from '../shared';

@Component({
  selector: 'app-pie-chart',
  templateUrl: './pie-chart.component.html',
  styleUrls: ['./pie-chart.component.css']
})
export class PieChartComponent implements OnInit {
  @Input() colours: Array<string>;
  @Input() defaultFilterOptions: Array<string>;
  @Input() MAXLEVEL: any;
  @Input() width: number;
  @Input() height: number;

  title = 'Pie Chart';


  //private width: number; // width of SVG
  //private height: number; // height of SVG
  private radius: number; // radius of Pie


  private arc: any;
  private arcGenerator: any;
  private labelArc: any;
  private pie: any;
  private pieGenerator: any;
  private color: any;
  private svg: any;
  private arcOver: any;
  private pieColours: any;

  // original filter options
  private originalFilters = [];
  private level = 0; // the deep of chart
  //private MAXLEVEL = Config._maxLevel; // the highest deep of chart
  //private MAXLEVEL = this.maxlevel;
  //private defaultFilterOptions = Config._defaultFilterOptions; // default filter
  //private defaultFilterOptions = this.defaultFilter; // default filter
  selectedSlice;
  private tooltip;
  private chart;
  private donut;
  private replyImg;
  private innerRadius = 20;

  tooltipModel: any = {
    cover: null,
    point: null,
    content: ""
  }; // model for tooltip
  donutStyle: any;

  _current: any; // temporaray variable for tween

  private _InitialChartData = [ // real chart data from raw data which is used for drawing chart. It has two fields named `type` & `percent`
    { type: "Used Benefit", percent: 0 },
    { type: "Unused Benefit", percent: 0 }
  ]

  constructor(private elRef: ElementRef) {
    this.selectedSlice = {};

  }


  /**
   * initialize component ===============================================================
   */
  ngOnInit() {

    this.radius = Math.min(this.width - 140, this.height) / 2;
    let options = this.getOptions(this.defaultFilterOptions[this.level]);
    this.replyImg = require('./img/reply.png');
    this.transformChartData(this.defaultFilterOptions[this.level], options);
    this.initSvg();
    this.drawPie();

  }

  /**
   * initialize SVG =======================================================================
   */
  private initSvg() {
    //this.width = document.getElementById('chart').offsetWidth;
    //this.height = document.getElementById('chart').offsetHeight;
    if (this._InitialChartData.length === 0) {
      return;
    }

    let colors = [];

    this._InitialChartData = this._InitialChartData.sort(function (a, b) {
      return b.percent - a.percent;
    });

    let colorStep = 200 / this._InitialChartData.length;
    colorStep = colorStep > 60 ? 60 : colorStep;
    let colorVal = 255;
    for (let i = 0; i < this._InitialChartData.length; i++) {
      if (this.level % 3 === 0) { // Hue : blue :=rgb(0, 0, 255)
        colors.push("rgb(20, 20," + colorVal + ')');
      }
      if (this.level % 3 === 1) { // Hue : green :=rgb(0, 255, 0)
        colors.push("rgb(20, " + colorVal + ", 20)");
      }
      if (this.level % 3 === 2) { // Hue : blue :=rgb(0, 0, 255)
        colors.push("rgb(" + colorVal + ",20, 20)");
      }
      colorVal -= colorStep;
    }

    this.color = d3Scale.scaleOrdinal()
      .range(colors);
    this.arc = d3Shape.arc()
      .outerRadius(this.radius)
      .innerRadius(this.innerRadius);

    this.arcGenerator = d3.arc()
      .innerRadius(this.innerRadius)
      .outerRadius(this.radius);

    this.arcOver = d3Shape.arc()
      .outerRadius(this.radius + 20)
      .innerRadius(40);
    this.labelArc = d3Shape.arc()
      .outerRadius(this.radius - 100)
      .innerRadius(this.radius - 100);
    this.pie = d3Shape.pie()
      .sort(null)
      .value((d: any) => d.percent);

    this.svg = d3.select('svg')
      .attr("preserveAspectRatio", "xMinYMin meet")
      .attr('viewBox', "-70 0 " + (this.width) + ' ' + (this.height))
      .append('g')
      .attr('transform', 'translate(' + this.width / 2 + ',' + this.height / 2 + ')').classed("svg-content", true);

  }

  /**
   * 
   * @param field : same as in getOptions
   * @param options : return result from getOptions
   */
  private transformChartData(field, options) {
    let item = null;
    this._InitialChartData = [];
    for (let i = 0; i < options.length; i++) {
      item = {};
      item.type = options[i];
      item.percent = 0;
      this._InitialChartData.push(item);
    }
    for (let i = 0; i < POPULATION.length; i++) {
      for (let j = 0; j < this._InitialChartData.length; j++) {
        item = this._InitialChartData[j];
        if (item.type === POPULATION[i][field]) {
          item.percent += 1;
          this._InitialChartData[j] = item;
        }
      }
    }
    let totalCount = 0;
    for (let i = 0; i < this._InitialChartData.length; i++) {
      item = this._InitialChartData[i];
      totalCount += item.percent;
    }
    for (let i = 0; i < this._InitialChartData.length; i++) {
      item = this._InitialChartData[i];
      item.percent = (item.percent / totalCount) * 100;
      this._InitialChartData[i] = item;
    }

  }

  /**
   * 
   * @param field : field of POPULATION which used to filter in proper level.
   * @returns options: current filter options which are used to display in paths or legend for current level.
   */
  private getOptions(field) {
    let result = POPULATION;
    let item = {};
    let i = 0;
    let options = [];
    for (i = 0; i < this.originalFilters.length; i++) {
      item = this.originalFilters[i];
      result = result.filter((d) => {
        return d[item['key']] === item['value'];
      })

    }
    for (i = 0; i < result.length; i++) {
      item = result[i];
      if (options.indexOf(item[field]) == -1) {
        options.push(item[field])
      }
    }
    return options;
  }

  // ====================================== drawing handler =====================================
  private drawPie() {

    // leave log about level
    console.log('Chart level ===============================================>', this.level + 1);

    let parent = this;
    let g = this.svg.selectAll('.arc')
      .data(this.pie(this._InitialChartData))
      .enter().append('g')
      .attr('class', 'arc');
    let path = g.append('path').attr('d', this.arc)
      .style('fill', (d: any) => parent.color(d.data.type))
      .style('stroke', '#ffffff') // border of pie
      .style('transform', 'scale(.95,.95)')

    g.append('text').attr('transform', (d: any) => 'translate(' + this.labelArc.centroid(d) + ')')
      .attr('dy', '.35em')
      .text((d: any) => d.data.percent.toFixed(2));

    // tooltip for path  
    this.svg.selectAll('.arc').data(this.pie(this._InitialChartData)).append("title").text((d: any) => { return d.data.type + ' : ' + (d.data.percent).toFixed(2) + '%' })
    // chart = svg
    this.chart = d3.select('svg');

    // donut
    //this.donut = this.svg.selectAll('.arc').append("text").attr("text-anchor", "middle").attr("font-size", "1em").attr("y", 5).text('reply').style('cursor', 'pointer');
    this.donut = this.svg.selectAll('.arc').append("image")
    .attr('xlink:href', this.replyImg)
    .attr("text-anchor", "middle")
    .attr('x', -10)
    .attr("y", -8)
    .style('cursor', 'pointer');
    // donut click handler
    this.donut.on("click", () => {
      console.log('this is donut hole');
      this.level = 0;
      this.originalFilters = [];
      let options = this.getOptions(this.defaultFilterOptions[this.level]);
      this.updatePie(options);
    });

    // ===================================== legend === start ====================================
    let count = 0;
    let legend = this.chart.selectAll(".legend")
      .data(this._InitialChartData).enter()
      .append("g").attr("class", "legend")
      .attr("legend-id", function (d) {
        return count++;
      })
      .attr("transform", function (d, i) {
        return "translate(15," + (parseInt("-" + (parent._InitialChartData.length * 10)) + i * 28 + 50) + ")";
      })
      .style("cursor", "pointer")
      .attr('title', (d) => {
        return d.type + ' ' + d.percent.toFixed(2)
      })

    //====================================== legend hover function =================================================
    legend.on("mouseover", function (d, i) {
      parent.chart.selectAll('path').filter(function (d, ii) { return i === ii }).style('transform', 'none')
    }).on("mouseout", function (d, i) {
      parent.chart.selectAll('path').filter(function (d, ii) { return i === ii }).style('transform', 'scale(.95,.95)')
    })
    // =============================================================================================================
    var leg = legend.append("circle");

    //leg.attr("cx", 32).attr("cy", 7)
    leg.attr("cx", -60).attr("cy", 7)
      .attr("r", 9)
      .style("fill", function (d) {
        return parent.color(d['type']);
      })
      .style("opacity", function (d) {
        return d.percent;
      });

    //legend.append("text").attr("x", 20)
    legend.append("text").attr("x", -50)
      .attr("y", 9).attr("dy", ".35em")
      .style("text-anchor", "start").text(function (d) {
        return d.type;
      })
      .attr('title', (d) => {
        return d.type + ' ' + d.percent;
      })
      .attr('width', 100)
      .attr('class', 'dotem');

    leg.append("svg:title")
      .text(function (d) {
        return d.type + " (" + d.percent.toFixed(2) + " %)";
      });


    // ================= end legend ========= Define click handlers ==============================
    this.chart.selectAll("path").on("click", function (d, i) { parent.onPathClick(d.data.type) });
    this.chart.selectAll(".legend").on("click", function (d, i) { parent.onPathClick(d.type) });

    this.chart.selectAll('.dotem').call((text) => {
      text.each(function () {
        var text = d3.select(this);
        var words = text.text().split('');
        var ellipsis = text.text('').append('tspan').attr('class', 'elip').text('...');
        var node: SVGTSpanElement = <SVGTSpanElement>ellipsis.node();
        var width = parseFloat(text.attr('width')) - node.getComputedTextLength();
        var numWords = words.length;

        var tspan = text.insert('tspan', ':first-child').text(words.join(''));
        var tnode: SVGTSpanElement = <SVGTSpanElement>tspan.node();
        // Try the whole line
        // While it's too long, and we have words left, keep removing words

        while (tnode.getComputedTextLength() > width && words.length) {
          words.pop();
          tspan.text(words.join(''));
        }

        if (words.length === numWords) {
          ellipsis.remove();
        }
      });
    })
    // ================================ end click handlers =======================================
    // ============================ Paths mouse move or out handler ==============================
    path.on("mousemove", function (d, i) {

      parent.selectedSlice = d.data;

      parent.tooltipModel.point = { 'background-color': this.style.fill };

      parent.tooltipModel.content = d.data.type + '  :  ' + d.data.percent.toFixed(2) + ' %';

      parent.tooltipModel.cover = { display: 'block', position: 'absolute', top: (d3.event.pageY - 50 * window.innerHeight / 974) + 'px', left: (d3.event.pageX - 540 * window.innerWidth / 1920) + 'px' };

      this.style.transition = 'all .1s ease-in-out';
      this.style.transform = 'none';

    }).on("mouseout", function (d) {

      this.style.transition = 'all .1s ease-in-out';
      this.style.transform = "scale(.95, .95)";
      parent.tooltipModel.cover = { display: 'none' };

    })

  }


  arcTween(newValues, i, slice) {
    const interpolation = d3.interpolate(slice.storedValues, newValues);
    slice.storedValues = interpolation(0);

    return (t) => {
      return this.arcGenerator(interpolation(t));
    };
  }

  // ============================= Paths click handler ======================================
  onPathClick = (filterOption) => {

    let options = [];
    $('text').html("");

    if (this.level < this.MAXLEVEL) {
      this.originalFilters.push({
        key: this.defaultFilterOptions[this.level], value: filterOption
      });
      this.level++;
      options = this.getOptions(this.defaultFilterOptions[this.level]);

    } else {
      this.level = 0;
      this.originalFilters = [];
      options = this.getOptions(this.defaultFilterOptions[this.level]);
    }
    $(this).css({
      'transition': 'all .1s ease-in-out',
      'transform': "none"
    });

    this.updatePie(options)

  }

  // =============== update pie if click paths, inner circle or legend ======================
  updatePie = (options) => {
    d3.selectAll("svg > *").remove();
    $('.content').hide().fadeIn("middle");
    this.transformChartData(this.defaultFilterOptions[this.level], options);
    this.initSvg();
    this.drawPie();
  }

  // =================  arc Tween (for animation) ============================================
  tweenIn = (data) => {
    data.startAngle = data.endAngle = (2 * Math.PI);
    let interpolation = d3.interpolate(this._current, data);
    this._current = interpolation(0);
    return function (t) {
      return this.arc(interpolation(t));
    }
  }

  tweenOut = (data) => {
    data.startAngle = data.endAngle = (2 * Math.PI);
    let interpolation = d3.interpolate(this._current, data);
    this._current = interpolation(0);
    return function (t) {
      return this.arc(interpolation(t));
    }
  }

}
