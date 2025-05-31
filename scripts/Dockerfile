FROM alpine:latest

RUN apk add --no-cache bash jq

WORKDIR /scripts

COPY scripts/generate-realm.sh .

COPY data/users.csv /data/users.csv
RUN chmod +x /scripts/generate-realm.sh

ENTRYPOINT ["bash", "/scripts/generate-realm.sh"]
