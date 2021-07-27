var defaultData = {
  dataSourceQuery: undefined,
  showDataLegend: true,
  showDataValues: true,
  showTotalEntries: false,
  autoRefresh: false
};
var data = $.extend(defaultData, Fliplet.Widget.getData());

var dsQueryData = {
  settings: {
    dataSourceTitle: 'Select a data source',
    default: {
      name: 'Chart data for ' + Fliplet.Env.get('appName')
    },
    modesDescription: 'How do you want your data to be plotted?',
    modes: [
      {
        label: 'Plot my data as it is',
        filters: false,
        columns: [
          {
            key: 'category',
            label: 'Select the column with the categories',
            type: 'single'
          },
          {
            key: 'value',
            label: 'Select the column with the values',
            type: 'single'
          }
        ]
      },
      {
        label: 'Summarise my data',
        filters: false,
        columns: [
          {
            key: 'column',
            label: 'Select a column',
            type: 'single'
          }
        ]
      }
    ]
  },
  accessRules: [
    {
      allow: 'all',
      enabled: true,
      type: [
        'select'
      ]
    }
  ],
  result: data.dataSourceQuery
};

var dsQueryProvider = Fliplet.Widget.open('com.fliplet.data-source-query', {
  selector: '.data-source-query',
  data: dsQueryData
});

function attachObservers() {
  dsQueryProvider.then(function(result) {
    Fliplet.Widget.save({
      dataSourceQuery: result.data,
      showDataLegend: $('#show_data_legend').is(':checked'),
      showDataValues: $('#show_data_values').is(':checked'),
      chartName: $('#chart_name').val(),
      showTotalEntries: $('#show_total_entries').is(':checked'),
      autoRefresh: $('#auto_refresh').is(':checked')
    }).then(function() {
      Fliplet.Widget.complete();
      Fliplet.Studio.emit('reload-page-preview');
    });
  });

  // Fired from Fliplet Studio when the external save button is clicked
  Fliplet.Widget.onSaveRequest(function() {
    dsQueryProvider.forwardSaveRequest();
  });
}

attachObservers();

// LOAD CHART SETTINGS
if (data) {
  $('#show_data_legend').prop('checked', data.showDataLegend);
  $('#show_data_values').prop('checked', data.showDataValues);
  $('#chart_name').val(data.chartName);
  $('#show_total_entries').prop('checked', data.showTotalEntries);
  $('#auto_refresh').prop('checked', data.autoRefresh);
}
