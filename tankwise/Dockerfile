# https://developers.home-assistant.io/docs/add-ons/configuration#add-on-dockerfile
ARG BUILD_FROM
FROM $BUILD_FROM

RUN pip3 install --no-cache-dir --break-system-packages aiohttp==3.11.18

WORKDIR /app
COPY rootfs/app/ /app/

ENV PYTHONUNBUFFERED=1
CMD ["python3", "-u", "/app/main.py"]
