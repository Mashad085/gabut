      *================================================================*
      * CFWALLET.cbl - KOIN Wallet Business Logic                     *
      * Args: action= from_balance= to_balance= amount= topup_amount= *
      * Actions: VALIDATE-TRANSFER | CALC-TRANSFER | TOPUP            *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CFWALLET.

       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER. LINUX.
       OBJECT-COMPUTER. LINUX.

       DATA DIVISION.
       WORKING-STORAGE SECTION.

       01  WS-ACTION           PIC X(20)  VALUE SPACES.
       01  WS-FROM-BAL         PIC 9(13)V99 VALUE ZEROS.
       01  WS-TO-BAL           PIC 9(13)V99 VALUE ZEROS.
       01  WS-AMOUNT           PIC 9(13)V99 VALUE ZEROS.

       01  WS-STATUS           PIC X(10)  VALUE 'OK'.
       01  WS-MSG              PIC X(200) VALUE SPACES.
       01  WS-NEW-FROM         PIC 9(13)V99 VALUE ZEROS.
       01  WS-NEW-TO           PIC 9(13)V99 VALUE ZEROS.

       01  WS-FROM-D           PIC Z(13).99.
       01  WS-TO-D             PIC Z(13).99.
       01  WS-OUT              PIC X(500) VALUE SPACES.

       01  WS-ARG-COUNT        PIC 9(3).
       01  WS-ARG-IDX          PIC 9(3).
       01  WS-ARG-VAL          PIC X(200).
       01  WS-KEY              PIC X(30).
       01  WS-VAL              PIC X(150).
       01  WS-POS              PIC 9(4).

       PROCEDURE DIVISION.
       0000-MAIN.
           PERFORM 1000-READ-ARGS
           PERFORM 2000-PROCESS
           PERFORM 9000-OUTPUT
           STOP RUN.

       1000-READ-ARGS.
           ACCEPT WS-ARG-COUNT FROM ARGUMENT-NUMBER
           MOVE 1 TO WS-ARG-IDX
           PERFORM UNTIL WS-ARG-IDX > WS-ARG-COUNT
               ACCEPT WS-ARG-VAL FROM ARGUMENT-VALUE
               PERFORM 1100-PARSE
               ADD 1 TO WS-ARG-IDX
           END-PERFORM.

       1100-PARSE.
           MOVE ZERO TO WS-POS
           INSPECT WS-ARG-VAL TALLYING WS-POS
               FOR CHARACTERS BEFORE '='
           IF WS-POS > 0
               MOVE WS-ARG-VAL(1:WS-POS)       TO WS-KEY
               MOVE WS-ARG-VAL(WS-POS + 2:100) TO WS-VAL
               EVALUATE FUNCTION TRIM(WS-KEY)
                   WHEN 'action'
                       MOVE FUNCTION TRIM(WS-VAL) TO WS-ACTION
                   WHEN 'from_balance'
                       MOVE FUNCTION NUMVAL(WS-VAL) TO WS-FROM-BAL
                   WHEN 'to_balance'
                       MOVE FUNCTION NUMVAL(WS-VAL) TO WS-TO-BAL
                   WHEN 'amount'
                       MOVE FUNCTION NUMVAL(WS-VAL) TO WS-AMOUNT
               END-EVALUATE
           END-IF.

       2000-PROCESS.
           EVALUATE FUNCTION TRIM(WS-ACTION)
               WHEN 'VALIDATE-TRANSFER'
                   PERFORM 3000-VALIDATE-TRANSFER
               WHEN 'CALC-TRANSFER'
                   PERFORM 4000-CALC-TRANSFER
               WHEN 'TOPUP'
                   PERFORM 5000-TOPUP
               WHEN OTHER
                   MOVE 'ERROR' TO WS-STATUS
                   MOVE 'Action tidak dikenal' TO WS-MSG
           END-EVALUATE.

       3000-VALIDATE-TRANSFER.
           MOVE WS-FROM-BAL TO WS-NEW-FROM
           MOVE WS-TO-BAL   TO WS-NEW-TO
           IF WS-AMOUNT <= ZEROS
               MOVE 'ERROR' TO WS-STATUS
               MOVE 'Jumlah KOIN harus lebih dari 0' TO WS-MSG
               EXIT PARAGRAPH
           END-IF
           IF WS-AMOUNT > 9999999.99
               MOVE 'ERROR' TO WS-STATUS
               MOVE 'Jumlah KOIN melebihi batas' TO WS-MSG
               EXIT PARAGRAPH
           END-IF
           IF WS-AMOUNT > WS-FROM-BAL
               MOVE 'ERROR' TO WS-STATUS
               MOVE 'Saldo KOIN tidak mencukupi' TO WS-MSG
           ELSE
               MOVE 'Validasi transfer KOIN berhasil' TO WS-MSG
           END-IF.

       4000-CALC-TRANSFER.
           IF WS-AMOUNT > WS-FROM-BAL
               MOVE 'ERROR' TO WS-STATUS
               MOVE 'Saldo KOIN tidak mencukupi' TO WS-MSG
               EXIT PARAGRAPH
           END-IF
           MOVE WS-FROM-BAL TO WS-NEW-FROM
           MOVE WS-TO-BAL   TO WS-NEW-TO
           SUBTRACT WS-AMOUNT FROM WS-NEW-FROM
           ADD      WS-AMOUNT TO   WS-NEW-TO
           MOVE 'Transfer KOIN berhasil' TO WS-MSG.

       5000-TOPUP.
           IF WS-AMOUNT <= ZEROS
               MOVE 'ERROR' TO WS-STATUS
               MOVE 'Jumlah top-up harus lebih dari 0' TO WS-MSG
               EXIT PARAGRAPH
           END-IF
           MOVE WS-TO-BAL TO WS-NEW-TO
           ADD  WS-AMOUNT TO WS-NEW-TO
           MOVE WS-FROM-BAL TO WS-NEW-FROM
           MOVE 'Top-up KOIN berhasil' TO WS-MSG.

       9000-OUTPUT.
           MOVE WS-NEW-FROM TO WS-FROM-D
           MOVE WS-NEW-TO   TO WS-TO-D
           MOVE SPACES TO WS-OUT
           STRING
               '{"status":"' DELIMITED SIZE
               FUNCTION TRIM(WS-STATUS) DELIMITED SIZE
               '","from_balance":' DELIMITED SIZE
               FUNCTION TRIM(WS-FROM-D) DELIMITED SIZE
               ',"to_balance":' DELIMITED SIZE
               FUNCTION TRIM(WS-TO-D) DELIMITED SIZE
               ',"message":"' DELIMITED SIZE
               FUNCTION TRIM(WS-MSG) DELIMITED SIZE
               '"}' DELIMITED SIZE
               INTO WS-OUT
           END-STRING
           DISPLAY FUNCTION TRIM(WS-OUT).
