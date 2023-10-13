/**
 * Copyright 2021 Thetis Apps Aps
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * 
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * 
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const axios = require('axios');

var AWS = require('aws-sdk');
AWS.config.update({region:'eu-west-1'});

/**
 * Send a response to CloudFormation regarding progress in creating resource.
 */
async function sendResponse(input, context, responseStatus, reason) {

	let responseUrl = input.ResponseURL;

	let output = new Object();
	output.Status = responseStatus;
	output.PhysicalResourceId = "StaticFiles";
	output.StackId = input.StackId;
	output.RequestId = input.RequestId;
	output.LogicalResourceId = input.LogicalResourceId;
	output.Reason = reason;
	await axios.put(responseUrl, output);
}

var sellerDataSchema = { type: 'object', properties: {
				"shopDomain": {"type": "string"},
				"accessToken": {"type": "string"},
                "locationName": {"type": "string"}}};

exports.initializer = async (input, context) => {
	
	try {
		let ims = await getIMS();
		let requestType = input.RequestType;
		if (requestType == "Create") {
			
			// Create a data extension to the seller entity

			let dataExtension = { entityName: 'seller', dataExtensionName: 'DFTransport', dataSchema: JSON.stringify(sellerDataSchema) };
			await ims.post('dataExtensions', dataExtension);

		} else if (requestType == 'Update') {
			
			// Update the data extension to the seller entity
			
			let response = await ims.get('dataExtensions');
			let dataExtensions = response.data;
			let found = false;
			let i = 0;
			while (i < dataExtensions.length && !found) {
				let dataExtension = dataExtensions[i];
				if (dataExtension.entityName == 'seller' && dataExtension.dataExtensionName == 'ShopifyIntegration') {
					found = true;
				} else {
					i++;
				}
			}
			if (found) {
				let dataExtension = dataExtensions[i];
				await ims.patch('dataExtensions/' + dataExtension.id, { dataSchema: JSON.stringify(sellerDataSchema) });
			} else {
				let dataExtension = { entityName: 'seller', dataExtensionName: 'ShopifyIntegration', dataSchema: JSON.stringify(sellerDataSchema) };
				await ims.post('dataExtensions', dataExtension);
			}
			
		}
		
		await sendResponse(input, context, "SUCCESS", "OK");

	} catch (error) {
		await sendResponse(input, context, "SUCCESS", JSON.stringify(error));
	}

};

async function getIMS() {

    const authUrl = "https://auth.thetis-ims.com/oauth2/";
    const apiUrl = "https://api.thetis-ims.com/2/";

	let clientId = process.env.ClientId;
	let clientSecret = process.env.ClientSecret;  
	let apiKey = process.env.ApiKey;  

    let credentials = clientId + ":" + clientSecret;
	let base64data = Buffer.from(credentials, 'UTF-8').toString('base64');	
	
	let imsAuth = axios.create({
			baseURL: authUrl,
			headers: { Authorization: "Basic " + base64data, 'Content-Type': "application/x-www-form-urlencoded" },
			responseType: 'json'
		});

    let response = await imsAuth.post("token", 'grant_type=client_credentials');
    let token = response.data.token_type + " " + response.data.access_token;
    
    let ims = axios.create({
    		baseURL: apiUrl,
    		headers: { "Authorization": token, "x-api-key": apiKey, "Content-Type": "application/json" }
    	});
	
	ims.interceptors.response.use(function (response) {
			console.log("SUCCESS " + JSON.stringify(response.data));
 	    	return response;
		}, function (error) {
			if (error.response) {
				console.log("FAILURE " + error.response.status + " - " + JSON.stringify(error.response.data));
			}
	    	return Promise.reject(error);
		});
		
    return ims;
}

async function getShopify(host, accessToken) {
    
    let shopify = axios.create({
    		baseURL: 'https://' + host + '/admin/api/2023-10/',
    		headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken }
    	});
    
	shopify.interceptors.response.use(function (response) {
			console.log("SUCCESS " + JSON.stringify(response.data));
 	    	return response;
		}, function (error) {
			if (error.response) {
				console.log("FAILURE " + error.response.status + " - " + JSON.stringify(error.response.data));
			}
	    	return Promise.reject(error);
		});
		
    return shopify;
}

async function getSetup(ims, shopDomain) {

    let response = await ims.get('sellers');
    let sellers = response.data;
    
    let i = 0;
    let found = false;
    let setup = null;
    while (i < sellers.length && !found) {
        let seller = sellers[i];
        let dataDocument = JSON.parse(seller.dataDocument);
        if (dataDocument != null) {
            setup = dataDocument.ShopifyIntegration;
            if (setup != null) {
                if (setup.shopDomain == shopDomain) {
                    found = true;
                } else {
                    i++;
                }                
            } else {
                i++;
            }
        } else {
            i++;
        }
    }    
        
    if (found) {
        return setup;
    }
    
    return null;
    
}

exports.webhook = async (event, context) => {
    
    console.log(JSON.stringify(event));
    
    console.log(event.body);
    
    let ims = await getIMS();
    
    let setup = await getSetup(ims, event.headers['X-Shopify-Shop-Domain']);

    let shopify = await getShopify(setup.shopDomain, setup.accessToken);

    if (setup.fulfillmentServiceId == null) {
        let callbackUrl = 'https://' + event.headers['Host'] + '/v1';
        let fulfillmentService = { callback_url: callbackUrl, name: 'Thetis IMS', handle: 'thetis-ims', inventory_management: true,
                permits_sku_sharing: true, requires_shipping_method: true, tracking_support: true, format: 'json', fulfillment_orders_opt_in: true
	        };
        let response = await shopify.put('fulfillment_services/58566312143.json', { fulfillment_service: fulfillmentService });
        fulfillmentService = response.data;
//        await ims.patch('sellers/' + seller.id )
    }
    
    let output = new Object();
    output.statusCode = 200;
	return output;
    
};

exports.fulfillmentOrderNotification = async (event, context) => {

    console.log(event.body);
    
    let output = new Object();
    output.statusCode = 200;
	return output;

};

