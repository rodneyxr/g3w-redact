const { base, inherit } = g3wsdk.core.utils;
const { PluginService } = g3wsdk.core.plugin;
const { GUI } = g3wsdk.gui;

function Service() {
  base(this);
  this.init = function (config = {}) {
    this.config = config;
    /**
     * Object where store key and setter name method to eventually remove when plugin is removed
     * @type {{}}
     */
    this.keySetters = {};
    /**
     * Get Query result service
     */
    this.queryresultsService = GUI.getService('queryresults');

    /**
     * True if the response is being processed
     */
    let processingResponse = false;

    /**
     * Intercept the query response and modify it
     */
    const keyOnAfterSetQueryResponse = this.queryresultsService.onafter('setQueryResponse', (response) => {
      // Prevent recursive calls by temporarily blocking the handler
      if (processingResponse) return;
      processingResponse = true;

      // console.log('Query response:', response);

      // Values not to process
      const valuesNotToEncode = ['boundedBy', 'fid', 'g3w_fid', 'geometry']

      response.data.forEach(dataItem => {
        if (dataItem.features && dataItem.features.length > 0) {
          dataItem.features.forEach(feature => {
            for (const key in feature.values_) {
              if (feature.values_.hasOwnProperty(key) && !valuesNotToEncode.includes(key)) {
                // TODO: TDF DECRYPT HERE
                feature.values_[key] = 'REDACTED';
              }
            }
          });
        }
      });
      // Set the modified response back to the service or display it
      console.log('Modified query response:', response);
      
      this.queryresultsService.setQueryResponse(response);
      processingResponse = false;
    });

    this.keySetters[keyOnAfterSetQueryResponse] = 'setQueryResponse';
  };

  this.clear = function () {
    /**
     * Unlisten to setters call events
     */
    Object.enties(this.keySetters).forEach(([key, setter]) => this.queryresultsService.un(setter, key));
  }
}

inherit(Service, PluginService);

module.exports = new Service;
