# PDF generator

## Setting Up

### Dependencies

- Docker
- Node ^20.12.2
- yarn
- AWS credentials

\*Last updated 2024/04/22

### Starting the server

- create a `.env` file based on the `.env.example` file. Ask a developer on the specific configuration
- run `yarn install` to install `node_modules`
- run `docker build -t lambda-with-pandoc .` to build 
- run `docker run --env-file .env  -p 9000:8080 lambda-with-pandoc` run the docker containers

### Calling the server

## Using curl

```bash
curl --location 'http://localhost:9000/2015-03-31/functions/function/invocations' --header 'Content-Type: application/json' --data '{ "userId":"c82da7d4-3295-4c4a-921b-7000d65224b6", "fileName": "my_set_pdf", "typeOfFile":"PDF", "markdown":"hi from local"}'
```

## From postman

POST url:
```bash
http://localhost:9000/2015-03-31/functions/function/invocations
```

body:
```json
[
    {
        "userId":"c82da7d4-3295-4c4a-921b-7000d65224b6",
        "fileName": "pokus_pdf",
        "typeOfFile":"PDF",
        "markdown":"hi from postman staging pdf"
    },
    {
        "userId":"c82da7d4-3295-4c4a-921b-7000d65224b6",
        "fileName": "pokus_tex",
        "typeOfFile":"TEX",
        "markdown":"hi from postman staging tex"
    }
]
```


## More information

https://github.com/lambda-feedback/technical-documentation/blob/main/docs/pdf_generator/index.md
