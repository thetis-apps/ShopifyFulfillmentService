# Description


# Installation

You may install the latest version of the application from the Serverless Application Repository. It is registered under the name thetis-ims-link-shopify-inventory-integration.

## Application settings

An instance of this application must be attached to a sales channel. Hence, when installing the application you must provide the number of the sales channel (SellerNumber).

- Application name
- ClientId 
- ClientSecret
- ApiKey 
- ContextId
- SellerNumber
- DevOpsEmail

# Configuration

You must create a 'custom application' in your Shopify account. When doing that Shopify generates an access token for you. You need these for the configuration of the application. 

You must make sure that the access token has the priviliges required. The required OAuth scopes are: write_inventory, read_inventory, read_products.

Shopify allows inventory to be spread out among many locations. Each location has its own set of inventory levels. For the application to know in which location to adjust the inventory levels, you must provide the name of the location that depicts your warehouse.

Therefore, in the data document of the sales channel:

```
{
  "LinkShopifyInventoryIntegration": {
    "host": "forste-test.myshopify.com",
    "accessToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "locationName": "Thetis"
  }
}
```

# Events

## Available stock changed

Every time available stock of a trade item changes, the application adjust the inventory level of the corresponding variant in Shopify. This is, however, subject to the condition that the change in available stock was not caused by a reservation made by Shopify. 

The application works well in a situation with many sales channels. If a reservation is made by another sales channel than the one attached to a given instance of this application, the change in available stock will cause the inventory level in Shopify to change. Only if the reservation is made by the sales channel related to said instance of the application, will the change in Thetis IMS not result in a corresponding change in Shopify.

# Notes

On installing this application the inventory levels in Shopify must be in sync with the stock in hand in Thetis IMS. The application only does incremental changes to the inventory levels. So, if the inventory levels are wrong from start they will continue to be wrong.
