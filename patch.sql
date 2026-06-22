UPDATE adelanto_proyecto SET saldoDisponible = monto WHERE saldoDisponible = 0 AND monto > 0 AND montoAplicado = 0;
