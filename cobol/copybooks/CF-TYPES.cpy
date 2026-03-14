      *================================================================*
      * CF-TYPES.cpy - Common data types for CommunityFinance COBOL   *
      *================================================================*
       01  WS-AMOUNT           PIC 9(13)V99 COMP-3.
       01  WS-BALANCE          PIC 9(13)V99 COMP-3.
       01  WS-RATE             PIC 9(3)V9(4) COMP-3.
       01  WS-RESULT           PIC 9(13)V99 COMP-3.
       01  WS-RETURN-CODE      PIC 9(4) VALUE ZEROS.
       01  WS-ERROR-MSG        PIC X(100) VALUE SPACES.
