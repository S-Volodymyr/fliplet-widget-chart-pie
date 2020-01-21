(function(){
  window.ui = window.ui || {}
  ui.flipletCharts = ui.flipletCharts || {};

  function init() {
    $('[data-chart-pie-id]').each(function (i, el) {
      var chartId = $(this).data('chart-pie-id');
      var data = Fliplet.Widget.getData(chartId);
      var $container = $(el);
      var refreshTimeout = 5000;
      var updateDateFormat = 'hh:mm:ss a';

      function resetData() {
        data.entries = [];
        data.totalEntries = 0;
        data.name = '';
      }

      function refreshData() {
        if (typeof data.dataSourceQuery !== 'object') {
          data.entries = [
            {name: 'A', y: 3, sliced: true, selected: true},
            {name: 'B', y: 2},
            {name: 'C', y: 1}
          ];
          data.totalEntries = 6;
          return Promise.resolve()
        }

        // beforeQueryChart is deprecated
        return Fliplet.Hooks.run('beforeQueryChart', data.dataSourceQuery).then(function() {
          return Fliplet.Hooks.run('beforeChartQuery', {
            config: data,
            id: data.id,
            uuid: data.uuid,
            type: 'pie'
          });
        }).then(function() {
          if (_.isFunction(data.getData)) {
            var response = data.getData();

            if (!(response instanceof Promise)) {
              return Promise.resolve(response);
            }

            return response;
          }

          return Fliplet.DataSources.fetchWithOptions(data.dataSourceQuery);
        }).then(function(result){
          // afterQueryChart is deprecated
          return Fliplet.Hooks.run('afterQueryChart', result).then(function () {
            return Fliplet.Hooks.on('afterChartQuery', {
              config: data,
              id: data.id,
              uuid: data.uuid,
              type: 'pie',
              records: result
            });
          }).then(function () {
            var columns = [];
            data.entries = [];
            data.totalEntries = 0;
            if (!result.dataSource.columns.length) {
              return Promise.resolve();
            }
            switch (data.dataSourceQuery.selectedModeIdx) {
              case 0:
              default:
                // Plot the data as is
                data.name = data.dataSourceQuery.columns.category;
                result.dataSourceEntries.forEach(function(row, i) {
                  data.entries.push({
                    name: row[data.dataSourceQuery.columns.category] || 'Category ' + (i+1),
                    y: parseInt(row[data.dataSourceQuery.columns.value]) || 0
                  });
                });
                break;
              case 1:
                // Summarise data
                data.name = 'Count of ' + data.dataSourceQuery.columns.column;
                result.dataSourceEntries.forEach(function(row) {
                  var value = row[data.dataSourceQuery.columns.column];

                  if (typeof value === 'string') {
                    value = $.trim(value);
                  }

                  if (!value) {
                    return;
                  }

                  if (!Array.isArray(value)) {
                    value = [value];
                  }

                  // Value is an array
                  value.forEach(function(elem) {
                    if ( columns.indexOf(elem) === -1 ) {
                      columns.push(elem);
                      data.entries[columns.indexOf(elem)] = {
                        name: elem,
                        y: 1
                      };
                    } else {
                      data.entries[columns.indexOf(elem)].y++;
                    }
                  });
                });
                break;
            }
            data.entries = _.reverse(_.sortBy(data.entries, function(o){
              return o.y;
            }));
            if (data.entries.length) {
              data.entries[0].sliced = true;
              data.entries[0].selected = true;
            }

            // SAVES THE TOTAL NUMBER OF ROW/ENTRIES
            data.totalEntries = _.reduce(data.entries, function(sum, o){
              return sum + o.y;
            }, 0);

            return Promise.resolve();
          }).catch(function(error){
            return Promise.reject(error);
          });
        })
      }

      function refreshChartInfo() {
        // Update total count
        $container.find('.total').html(data.totalEntries);
        // Update last updated time
        $container.find('.updatedAt').html(moment().format(updateDateFormat));
      }

      function refreshChart() {
        // Retrieve chart object
        var chart = ui.flipletCharts[chartId];
        // Update values
        chart.series[0].setData(data.entries);
        refreshChartInfo();
      }

      function getLatestData() {
        return new Promise(function (resolve, reject) {
          setTimeout(function () {
            refreshData().then(function () {
              if (data.autoRefresh) {
                getLatestData();
              }

              refreshChart();
              resolve();
            }).catch(function (err) {
              if (data.autoRefresh) {
                getLatestData();
              }

              reject(err);
            });
          }, refreshTimeout);
        });
      }

      function drawChart() {
        var colors = [
          '#00abd1', '#ed9119', '#7D4B79', '#F05865', '#36344C',
          '#474975', '#8D8EA6', '#FF5722', '#009688', '#E91E63'
        ];
        colors.forEach(function eachColor (color, index) {
          if (!Fliplet.Themes) {
            return;
          }
          colors[index] = Fliplet.Themes.Current.get('chartColor'+(index+1)) || color;
        });
        var chartOpt = {
          chart: {
            type: 'pie',
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false,
            renderTo: $container.find('.chart-container')[0],
            style: {
              fontFamily: (Fliplet.Themes && Fliplet.Themes.Current.get('bodyFontFamily')) || 'sans-serif'
            },
            events: {
              load: function(){
                refreshChartInfo();
                if (data.autoRefresh) {
                  getLatestData();
                }
              },
              render: function () {
                Fliplet.Hooks.run('afterChartRender', {
                  chart: ui.flipletCharts[chartId],
                  chartOptions: chartOpt,
                  id: data.id,
                  uuid: data.uuid,
                  type: 'pie',
                  config: data
                });
              }
            }
          },
          colors: colors,
          title: {
            text: ''
          },
          subtitle: {
            text: ''
          },
          navigation: {
            buttonOptions: {
              enabled: false
            }
          },
          tooltip: {
            pointFormat: '{series.name}: <strong>{point.percentage:.1f}%</strong> '
          },
          plotOptions: {
            pie: {
              allowPointSelect: true,
              cursor: 'pointer',
              dataLabels: {
                enabled: data.showDataValues,
                format: [
                  (!data.showDataLegend ? '<strong>{point.name}</strong>: ' : ''),
                  '{point.y}'
                ].join(''),
                style: {
                  color: (Highcharts.theme && Highcharts.theme.contrastTextColor) || 'black'
                }
              },
              showInLegend: data.showDataLegend
            }
          },
          legend: {
            itemStyle: {
              width: '100%'
            }
          },
          series: [{
            name: data.name,
            colorByPoint: true,
            innerSize: '0%',
            data: data.entries,
            events: {
              click: function () {
                Fliplet.Analytics.trackEvent({
                  category: 'chart',
                  action: 'data_point_interact',
                  label: 'pie'
                });
              },
              legendItemClick: function () {
                Fliplet.Analytics.trackEvent({
                  category: 'chart',
                  action: 'legend_filter',
                  label: 'pie'
                });
              }
            }
          }],
          credits: {
            enabled: false
          }
        };
        // Create and save chart object
        Fliplet.Hooks.run('beforeChartRender', {
          chartOptions: chartOpt,
          id: data.id,
          uuid: data.uuid,
          type: 'pie',
          config: data
        }).then(function () {
          ui.flipletCharts[chartId] = new Highcharts.Chart(chartOpt);
        });
      }

      function redrawChart() {
        ui.flipletCharts[chartId].reflow();
      }

      if (Fliplet.Env.get('interact')) {
        // TinyMCE removes <style> tags, so we've used a <script> tag instead,
        // which will be appended to <body> to apply the styles
        $($(this).find('.chart-styles').detach().html()).appendTo('body');
      } else {
        $(this).find('.chart-styles').remove();
      }

      Fliplet.Hooks.on('appearanceChanged', redrawChart);
      Fliplet.Hooks.on('appearanceFileChanged', redrawChart);

      refreshData().then(drawChart).catch(function(error){
        console.error(error);
      });
    });
  }

  Fliplet().then(function(){
    var debounceLoad = _.debounce(init, 500, { leading: true });
    Fliplet.Studio.onEvent(function (event) {
      if (event.detail.event === 'reload-widget-instance') {
        debounceLoad();
      }
    });

    init();
  });
})();
