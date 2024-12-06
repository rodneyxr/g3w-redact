const { base, inherit } = g3wsdk.core.utils;
const { PluginService } = g3wsdk.core.plugin;
const { GUI } = g3wsdk.gui;

function decrypt(b64encodedbinary) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'http://localhost:8081/decrypt', false); // false makes the request synchronous
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify({ data: b64encodedbinary }));

  if (xhr.status === 200) {
    const result = JSON.parse(xhr.responseText);
    return atob(result.data); // base64 decoded result
  } else {
    console.error('Error decrypting data:', xhr.statusText);
    throw new Error(xhr.statusText);
  }
}

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

      console.log('Query response:', response);

      // Values not to process
      const valuesNotToEncode = ['boundedBy', 'fid', 'g3w_fid', 'geometry']

      response.data.forEach(dataItem => {
        if (dataItem.features && dataItem.features.length > 0) {
          dataItem.features.forEach(feature => {
            for (const key in feature.values_) {
              if (feature.values_.hasOwnProperty(key) && !valuesNotToEncode.includes(key)) {
                if (key == 'name') {
                  try {
                    var binaryData;
                    
                    try {
                      binaryData = atob(feature.values_[key]);
                    } catch (e) {
                      if (e instanceof DOMException && e.name === 'InvalidCharacterError') {
                        continue;
                      }
                      console.error('Error decoding base64 string:', e);
                    }

                    const magicNumber = binaryData.slice(0, 4);
                    if (magicNumber == 'PK\x03\x04') {
                      // It's likely a ZIP file here
                      console.log('ZIP file detected: ', feature.values_[key]);

                      var cleartext = 'ENCRYPTED DATA';
                      try {
                        // Decrypt the ZIP file
                        cleartext = decrypt(feature.values_[key]);
                        console.log('decrypted content:', cleartext);
                      } catch (e) {
                        console.error('Error decrypting ZIP file:', e);
                      }

                      // Display cleartext
                      feature.values_[key] = cleartext;
                    }
                  } catch (e) {
                    console.error('Error decrypting data:', e);
                  }
                }
              }
            }
          });
        }
      });

      // Set the modified response back to the service
      this.queryresultsService.setQueryResponse(response);
      console.log('Modified query response:', response);

      // Release the handler
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
