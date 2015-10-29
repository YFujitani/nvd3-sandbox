var dateFormat = d3.time.format("%Y%m%d");

var color = d3.scale.category10();

function groupDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseQiitaDate(date) {
  return new Date(date.replace(/-/g, '/'));
}

var Tag = React.createClass({
  render: function() {
    var tag = this.props.tag;
    return (
      <div className="tag" style={{ borderColor: color(tag.index) }}>
        <span className="tag-name">{tag.name}</span>
        <i className="fa fa-plus" onClick={this.props.onMore} title="add"></i>
        <i className="fa fa-times" onClick={this.props.onRemove} title="delete"></i>
      </div>
    );
  }
});

var TagList = React.createClass({
  render: function() {
    var tagNodes = this.props.data.map(function(tag) {
      var onMore = function() { this.props.onMore(tag) }.bind(this);
      var onRemove = function() { this.props.onRemove(tag) }.bind(this);
      return (
        <Tag tag={tag} onMore={onMore} onRemove={onRemove} />
      );
    }.bind(this));
    return (
      <div className="tagList">{tagNodes}</div>
    );
  }
});

var TagForm = React.createClass({
  handleSubmit: function(e) {
    e.preventDefault();
    var name = React.findDOMNode(this.refs.name).value.trim();
    if (!name) return;
    this.props.onSubmit(name);
    React.findDOMNode(this.refs.name).value = '';
  },
  render: function() {
    return (
      <div className="tagForm">
        <form onSubmit={this.handleSubmit}>
          <input type="text" ref="name" autoFocus placeholder="Add Tag"/>
        </form>
      </div>
    );
  }
});

var Chart = React.createClass({
  createDataset: function() {
    var firstDate = new Date(d3.min(this.props.data, function(d) { return d.firstDate })),
        lastDate = dateFormat.parse(dateFormat(new Date()));

    var dataset = this.props.data.map(function(tag, i) {

      // posts aggregation
      var items = d3.nest()
                  .key(function(d) { return +groupDate(d) })
                  .sortKeys(function(d1, d2) { return d1 - d2 })
                  .rollup(function(d) { return d.length })
                  .entries(tag.data);

      // set 0 to no post date
      var fill0 = [];
      for (var date = new Date(tag.firstDate); date <= lastDate; date.setDate(date.getDate() + 1)) {
        fill0.push({
          key: +groupDate(date),
          values: 0
        });
      }

      var values = d3.nest()
                  .key(function(d) { return d.key })
                  .sortKeys(function(d1, d2) { return d1 - d2 })
                  .rollup(function(d) { return d3.sum(d, function(d) { return d.values }) })
                  .entries(d3.merge([items, fill0]))

      return {
        key: tag.name,
        values: values,
        color: color(tag.index)
      };
    });
    return dataset;
  },
  componentDidMount: function() {
    this.showChart();
  },
  componentDidUpdate: function() {
    this.showChart();
  },
  showChart: function() {

    var dataset = this.createDataset();
    console.log(dataset);

    // nv.addGraph(function() {
    //   var chart = this.chart = nv.models.lineChart()
    //     .margin({left: 80, right: 40})
    //     .useInteractiveGuideline(true)
    //     .transitionDuration(350)
    //     .showLegend(false)
    //     .showYAxis(true)
    //     .showXAxis(true)
    //     .x(function(d) { return new Date(+(d.key)) })
    //     .y(function(d) { return d.values });
    //
    //
    //   chart.xAxis
    //     .axisLabel('Posted Date')
    //     .tickFormat(function(d) { return dateFormat(new Date(d)) });
    //
    //   chart.yAxis
    //     .axisLabel('Number of post')
    //     .tickFormat(d3.format(',.5d'));
    //
    //   d3.select(React.findDOMNode(this.refs.svg))
    //       .datum(dataset)
    //       .transition()
    //       .duration(0)
    //       .call(chart)
    //
    //   nv.utils.windowResize(chart.update);
    // }.bind(this));

    nv.addGraph(function() {
      var chart = this.chart = nv.models.multiBarChart()
        //.margin({left: 80, right: 40})
        //.useInteractiveGuideline(true)
        .transitionDuration(350)
        .reduceXTicks(true)   //If 'false', every single x-axis tick label will be rendered.
        .rotateLabels(0)      //Angle to rotate x-axis labels.
        .showControls(true)   //Allow user to switch between 'Grouped' and 'Stacked' mode.
        .groupSpacing(0.1)    //Distance between each group of bars.
        .x(function(d) { return new Date(+(d.key)) })
        .y(function(d) { return d.values });
      ;

      chart.xAxis
          .axisLabel('Posted Date')
          .tickFormat(function(d) { return dateFormat(new Date(d)) });

      chart.yAxis
          .axisLabel('Number of post')
          .tickFormat(d3.format(d3.format(',.5d')));

      d3.select(React.findDOMNode(this.refs.svg))
          .datum(dataset)
          .transition()
          .duration(0)
          .call(chart);

      nv.utils.windowResize(chart.update);
    }.bind(this));
  },
  render: function() {
    return (
      <div className="chart">
        <svg ref="svg"></svg>
      </div>
    );
  },
});

var QiitaTrend = React.createClass({

  getInitialState: function() {
    return { data: [] };
  },

  loadTagItems: function(tag) {
    this.refs.mask.mask();
    return new Promise(function(resolve, reject) {
      $.ajax({
        url: 'http://qiita.com/api/v1/tags/' + tag.name + '/items',
        data: { per_page: 100, page: tag.pageCount + 1 },
        dataType: 'json',
        success: function(data) {
          this.refs.mask.unmask();
          resolve(data);
        }.bind(this),
        error: function(xhr, status, err) {
          this.refs.mask.unmask();
          reject({status: status, err: err});
        }.bind(this)
      });
    }.bind(this));
  },

  loadFailed: function(result) {
    alert(result.err + '(' + result.status + ')');
  },

  parseTagItems: function(tag, data) {
    tag.pageCount++;
    tag.data = tag.data.concat(data.map(function(item) {
      return parseQiitaDate(item.created_at);
    }));
    tag.data.sort(function(a,b) { return +a - +b });
    tag.firstDate = tag.data.length > 0 ? tag.data[0] : null;
    return tag;
  },

  add: function(name) {
    var tag = {
      name: name,
      pageCount: 0,
      data: [],
      firstDate: null,
      index: this.state.data.length
    };
    this.load(tag);
  },

  load: function(tag) {
    this.loadTagItems(tag).then(
      function(data) {
        this.parseTagItems(tag, data);
        this.state.data.indexOf(tag) == -1 && this.state.data.push(tag);
        this.setState({});
      }.bind(this),
      function(xhr, status, err) {
        this.loadFailed(xhr, status, err);
      }.bind(this)
    );
  },

  remove: function(tag) {
    var data = this.state.data.filter(function(d) { return d != tag });
    data.forEach(function(tag, i) {
      tag.index = 1;
    });
    this.setState({ data: data });
  },

  render: function() {
    var chart = this.state.data.length != 0 ? <Chart data={this.state.data} ref="chart"/> : null;
    return (
      <div className="qiitaTrend">
        <Mask display={false} ref="mask" />
        <TagForm onSubmit={this.add} />
        <TagList data={this.state.data} onMore={this.load} onRemove={this.remove} />
        {chart}
      </div>
    );
  }
});

var Mask = React.createClass({

  getInitialState: function() {
      return { enable: this.props.enable };
  },

  mask: function() {
      this.setState({ enable: true });
  },

  unmask: function() {
      this.setState({ enable: false });
  },

  render: function() {
    var display = this.state.enable ? 'block' : 'none';
    return (
      <div className="mask" style={{display: display}} ref="mask">
        <div>Loading...</div>
      </div>
    );
  },
});

React.render(
  <QiitaTrend/>,
  document.getElementById('content')
);
