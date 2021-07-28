(function(){
  window.ui = window.ui || {}
  ui.flipletCharts = ui.flipletCharts || {};

  Fliplet.Chart = Fliplet.Widget.Namespace('chart');

  function init() {
    Fliplet.Widget.instance('chart-pie-1-1-0', function (data) {
      var chartId = data.id;
      var $container = $(this);
      var instanceTheme = Fliplet.Themes.Current.getInstance()
      var themeValues = instanceTheme.data.values;
      var inheritColor1 = true;
      var inheritColor2 = true;
      var refreshTimeout = 5000;
      var refreshTimer;
      var updateDateFormat = 'hh:mm:ss a';
      var colors = [];
      var cashColors = [
        '#00abd1', '#ed9119', '#7D4B79', '#F05865', '#36344C',
        '#474975', '#8D8EA6', '#FF5722', '#009688', '#E91E63'
      ];
      var deviceType;
      var deviceColors = {
        Mobile: {
          refresh: true,
          colors: []
        },
        Tablet: {
          refresh: true,
          colors: []
        },
        Desktop: {
          refresh: true,
          colors: []
        }
      };
      var chartInstance;
      var chartReady;
      var chartPromise = new Promise(function(resolve) {
        chartReady = resolve;
      });

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
            return Fliplet.Hooks.run('afterChartQuery', {
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

        if (!chart) {
          return drawChart();
        }

        // Update values
        chart.series[0].setData(data.entries);
        refreshChartInfo();
        return Promise.resolve(chart);
      }

      function refresh() {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }

        return refreshData().then(function () {
          if (data.autoRefresh) {
            setRefreshTimer();
          }

          return refreshChart();
        }).catch(function (err) {
          if (data.autoRefresh) {
            setRefreshTimer();
          }

          return Promise.reject(err);
        });
      }

      function setRefreshTimer() {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }

        refreshTimer = setTimeout(refresh, refreshTimeout);
      }

      function inheritColor(inheritanceColorKey, colorsArray, colorIndex) {
        var inheritanceColor = themeValues[inheritanceColorKey];

        if (inheritanceColor) {
          colorsArray[colorIndex] = inheritanceColor;
        }
      }

      function getDeviceType() {
        if (Modernizr.mobile) {
          return '';
        } else if (Modernizr.tablet) {
          return 'Tablet';
        } else {
          return 'Desktop';
        };
      }

      Fliplet.Studio.onEvent(function(event) {
        var eventDetail = event.detail;
        
        if (eventDetail && eventDetail.type === 'savingNewStyles') setThemeValues(eventDetail.values);
        
        if (eventDetail && eventDetail.type === 'colorChange') {
          if (eventDetail.widgetId && eventDetail.widgetId !== chartId) {
            return;
          }

          var colorIndex = null;
          switch (eventDetail.label) {
            case 'Highlight color':
              if (inheritColor1) {
                colorIndex = 0;
              }
              break;
            case 'Secondary color':
              if (inheritColor2) {
                colorIndex = 1;
              }
              break;
            case 'Chart color 1':
              inheritColor1 = false;
              break;
            case 'Chart color 2':
              inheritColor2 = false;
              break;
            default:
              break;
          }

          if (colorIndex === null) {
            var labelIndex = eventDetail.label.match(/[0-9]{1,2}/);
            if (labelIndex === null) {
              return;
            }

            colorIndex = labelIndex[0] - 1;
          }

          updateColors(colorIndex, eventDetail.color)
        }
      });

      // Set new colors for chart
      function setThemeValues(colors) {
        themeValues = colors
        deviceColors.Mobile.refresh = true;
        deviceColors.Tablet.refresh = true;
        deviceColors.Desktop.refresh = true;
        genColors()
        var newColors = getColors()
        chartInstance.update({
          colors: newColors
        });
      }

      // Updates color for current device
      function updateColors(index, color) {
        var editColors = getColors()
        editColors[index] = color
        chartInstance.update({
          colors: editColors
        });
      }

      // Get color for current device
      function getColor(key, device) {
        if (!device) {
          return themeValues[key];
        } else {
          var color = themeValues[key + device];
          if(color === 'inherit-tablet') return getColor(key, 'Tablet')
          else if(color === 'inherit-mobile') return getColor(key, '')
          else return color
        }
      }

      // Generate colors for current device
      function genColors() {
        colors = cashColors.slice();
        colors.forEach(function eachColor(color, index) {
          if (!Fliplet.Themes) {
            return;
          }

          var colorKey = 'chartColor' + (index + 1);
          var newColor = getColor(colorKey, deviceType);

          if (newColor) {
            colors[index] = newColor;
            inheritColor1 = colorKey !== 'chartColor1';
            inheritColor2 = colorKey !== 'chartColor2';
          } else if (colorKey === 'chartColor1' && inheritColor1) {
            inheritColor('highlightColor', colors, index);
          } else if (colorKey === 'chartColor2' && inheritColor2) {
            inheritColor('secondaryColor', colors, index);
          }
        });

        return colors;
      }

      // Get colors for device
      function getColors() {
        if (!deviceType && deviceColors.Mobile.refresh) {
          deviceColors.Mobile.colors = genColors();
          deviceColors.Mobile.refresh = false;
        } else if (deviceColors[deviceType] && deviceColors[deviceType].refresh) {
          deviceColors[deviceType].colors = genColors();
          deviceColors[deviceType].refresh = false;
        }

        return deviceColors[deviceType ? deviceType : 'Mobile'].colors;
      }

      function drawChart() {
        return new Promise(function(resolve, reject) {
          var cols = getColors();
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
                    setRefreshTimer();
                  }
                },
                render: function () {
                  ui.flipletCharts[chartId] = this;
                  Fliplet.Hooks.run('afterChartRender', {
                    chart: ui.flipletCharts[chartId],
                    chartOptions: chartOpt,
                    id: data.id,
                    uuid: data.uuid,
                    type: 'pie',
                    config: data
                  });
                  resolve(this);
                }
              }
            },
            colors: cols,
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
            try {
              chartInstance = new Highcharts.Chart(chartOpt);
            } catch (e) {
              return Promise.reject(e);
            }
          }).catch(reject);
        });
      }

      var debouncedRedrawChart = _.debounce(function() {
        var colors = getColors();
        updateColors(colors)
      }, 200);

      $(window).on('resize', function() {
        deviceType = getDeviceType();
        debouncedRedrawChart();
      });

      if (Fliplet.Env.get('interact')) {
        $($(this).find('.chart-styles').detach().html()).appendTo('body');
      } else {
        $(this).find('.chart-styles').remove();
      }

      refreshData().then(drawChart).catch(function() {
        setRefreshTimer();
      });

      Fliplet.Chart.add(chartPromise);

      chartReady({
        name: data.chartName,
        type: 'pie',
        refresh: refresh
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