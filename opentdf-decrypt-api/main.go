package main

import (
	"bytes"
	"encoding/base64"
	"io"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/opentdf/platform/sdk"
)

type DecryptRequest struct {
	Data string `json:"data"`
}

type DecryptResponse struct {
	Data string `json:"data"`
}

func getClient() (*sdk.SDK, error) {
	sdkOpts := []sdk.Option{}
	sdkOpts = append(sdkOpts, sdk.WithClientCredentials("opentdf", "secret", nil))
	sdkOpts = append(sdkOpts, sdk.WithTokenEndpoint("http://localhost:8888/auth/realms/opentdf/protocol/openid-connect/token"))
	sdkOpts = append(sdkOpts, sdk.WithInsecurePlaintextConn())
	return sdk.New("localhost:8080", sdkOpts...)
}

func decrypt(c *gin.Context) {
	var req DecryptRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Decode base64 input
	encryptedData, err := base64.StdEncoding.DecodeString(req.Data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid base64 data"})
		return
	}

	client, err := getClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create reader from encrypted data
	tdfReader := bytes.NewReader(encryptedData)

	// Check for TDF type
	var magic [3]byte
	_, err = io.ReadFull(tdfReader, magic[:])
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid TDF data"})
		return
	}

	// Reset reader to beginning
	tdfReader.Seek(0, 0)

	// Create buffer for decrypted data
	var decryptedBuf bytes.Buffer

	// Decrypt based on TDF type
	if bytes.HasPrefix(magic[:], []byte("L1L")) {
		// Handle Nano TDF
		_, err = client.ReadNanoTDF(&decryptedBuf, tdfReader)
	} else {
		// Handle regular TDF
		tdfreader, err := client.LoadTDF(tdfReader)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		_, err = io.Copy(&decryptedBuf, tdfreader)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Encode decrypted data as base64
	response := DecryptResponse{
		Data: base64.StdEncoding.EncodeToString(decryptedBuf.Bytes()),
	}

	c.JSON(http.StatusOK, response)
}

func main() {
	r := gin.Default()

	// Configure CORS
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Content-Type"}
	r.Use(cors.New(config))

	// Routes
	r.POST("/decrypt", decrypt)

	// Start server
	r.Run(":8081")
}
