# services/ai-service/app/rabbitmq/consumer.py
import json
import logging
from collections.abc import Callable
from typing import Any

import pika
from pika.adapters.blocking_connection import BlockingChannel

logger = logging.getLogger(__name__)


def start_rabbitmq_consumer(
    host: str,
    port: int,
    user: str,
    password: str,
    exchange: str,
    on_traffic_update: Callable[[dict[str, Any]], None],
) -> None:
    credentials = pika.PlainCredentials(user, password)
    parameters = pika.ConnectionParameters(
        host=host,
        port=port,
        credentials=credentials,
        heartbeat=600,
        blocked_connection_timeout=300,
    )

    connection = pika.BlockingConnection(parameters)
    channel: BlockingChannel = connection.channel()

    channel.exchange_declare(exchange=exchange, exchange_type="topic", durable=True)

    result = channel.queue_declare(queue="ai-service.traffic-events", durable=True)
    queue_name = result.method.queue

    channel.queue_bind(queue=queue_name, exchange=exchange, routing_key="traffic.updated")

    def callback(ch: BlockingChannel, method: Any, properties: Any, body: bytes) -> None:
        try:
            event = json.loads(body.decode("utf-8"))
            logger.debug(f"Evento recibido: {event.get('eventType')} en {method.routing_key}")
            if event.get("eventType") == "TrafficUpdated":
                on_traffic_update(event)
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:  # noqa: BLE001 - un mensaje dañado se descarta (nack) sin tumbar el consumidor
            logger.error(f"Error procesando mensaje: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    channel.basic_consume(queue=queue_name, on_message_callback=callback)
    logger.info(f"AI Service escuchando cola {queue_name} en exchange {exchange}")
    channel.start_consuming()
